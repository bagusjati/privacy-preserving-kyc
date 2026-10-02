/* Latency measurement of the eKYC chaincode operations on the rebuilt
 * four-organization Fabric 2.4.7 network (native processes, LevelDB,
 * single host). Submits via the Org1 peer gateway; the endorsement policy
 * OR('Org1MSP.peer','Org2MSP.peer') is satisfied by the Org1 peer.
 * Writes use submitTransaction (endorse + order + commit event),
 * reads use evaluateTransaction (endorse only).
 */
const grpc = require('@grpc/grpc-js');
const { connect, signers } = require('@hyperledger/fabric-gateway');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const B = process.env.BENCH_DIR || path.join(os.homedir(), 'bench');
const ORG1 = path.join(B, 'organizations/peerOrganizations/org1.example.com');
const N = parseInt(process.env.N || '100', 10);
const WARMUP = 10;

async function newGateway() {
    const tlsCert = fs.readFileSync(path.join(ORG1, 'peers/peer0.org1.example.com/tls/ca.crt'));
    const client = new grpc.Client('127.0.0.1:7051', grpc.credentials.createSsl(tlsCert));
    const idDir = path.join(ORG1, 'users/User1@org1.example.com');
    const certPath = fs.readdirSync(path.join(idDir, 'msp/signcerts'))[0];
    const keyPath = fs.readdirSync(path.join(idDir, 'msp/keystore'))[0];
    const credentials = fs.readFileSync(path.join(idDir, 'msp/signcerts', certPath));
    const key = crypto.createPrivateKey(fs.readFileSync(path.join(idDir, 'msp/keystore', keyPath)));
    return connect({
        client,
        identity: { mspId: 'Org1MSP', credentials },
        signer: signers.newPrivateKeySigner(key),
        evaluateOptions: () => ({ deadline: Date.now() + 30000 }),
        endorseOptions: () => ({ deadline: Date.now() + 30000 }),
        submitOptions: () => ({ deadline: Date.now() + 30000 }),
        commitStatusOptions: () => ({ deadline: Date.now() + 60000 }),
    });
}

// 512-byte base64 payload standing in for one ECIES ciphertext
const PAYLOAD = crypto.randomBytes(384).toString('base64');

function stats(arr) {
    const a = [...arr].sort((x, y) => x - y);
    const mean = a.reduce((s, v) => s + v, 0) / a.length;
    const sd = Math.sqrt(a.reduce((s, v) => s + (v - mean) ** 2, 0) / a.length);
    const q = p => a[Math.min(a.length - 1, Math.floor(p * a.length))];
    return { n: a.length, mean: +mean.toFixed(1), sd: +sd.toFixed(1),
             median: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1),
             min: +a[0].toFixed(1), max: +a[a.length - 1].toFixed(1) };
}

async function run() {
    const gw = await newGateway();
    const contract = gw.getNetwork('mychannel').getContract('eKYC');
    const results = {};

    async function series(label, fn, n = N) {
        for (let i = 0; i < WARMUP; i++) await fn(`w${i}`);
        const lat = [];
        for (let i = 0; i < n; i++) {
            const t0 = process.hrtime.bigint();
            await fn(`m${i}`);
            lat.push(Number(process.hrtime.bigint() - t0) / 1e6);
        }
        results[label] = stats(lat);
        console.log(label, JSON.stringify(results[label]));
    }

    const R = crypto.randomBytes(4).toString('hex');

    // write path (submit: endorse + order + commit)
    await series('createUserProfile', i =>
        contract.submitTransaction('createUserProfile', `user-${R}-${i}`, `0x${R}${i}`));
    await series('requestValidation', i =>
        contract.submitTransaction('requestValidation', `0xwallet-${R}-${i}`, 'FI1', new Date().toISOString()));
    await series('submitKycData', i =>
        contract.submitTransaction('submitKycData', `cust-${R}-${i}`, PAYLOAD));
    await series('validateRequestValidation', i =>
        contract.submitTransaction('validateRequestValidation', `0xwallet-${R}-${i}`, 'FI1', 'Org1MSP', 'accepted'));
    await series('illicitActivities', i =>
        contract.submitTransaction('illicitActivities', `0xwallet-${R}-${i}`, 'Illicit', 'FI1', 'Org1MSP'));

    // read path (evaluate: endorse only)
    await series('getRequestValidation', i =>
        contract.evaluateTransaction('getRequestValidation', `0xwallet-${R}-m${Math.floor(Math.random() * N)}`));
    await series('getKycData', i =>
        contract.evaluateTransaction('getKycData', `cust-${R}-m${Math.floor(Math.random() * N)}`, 'FI1', 'Org1MSP'));

    // dashboard listing: full range scan over the public state
    const h = await contract.evaluateTransaction('getRequestsByDesignatedBank', 'FI1');
    results.stateEntriesApprox = JSON.parse(Buffer.from(h).toString()).length;
    await series('getRequestsByDesignatedBank', () =>
        contract.evaluateTransaction('getRequestsByDesignatedBank', 'FI1'), 30);


    // decomposition of one write operation: endorsement vs ordering+commit
    const dec = { endorse: [], orderCommit: [] };
    for (let i = 0; i < 40; i++) {
        const prop = contract.newProposal('requestValidation',
            { arguments: [`0xdec-${R}-${i}`, 'FI1', new Date().toISOString()] });
        const t0 = process.hrtime.bigint();
        const txn = await prop.endorse();
        const t1 = process.hrtime.bigint();
        const sub = await txn.submit();
        await sub.getStatus();
        const t2 = process.hrtime.bigint();
        dec.endorse.push(Number(t1 - t0) / 1e6);
        dec.orderCommit.push(Number(t2 - t1) / 1e6);
    }
    results.decompose_endorse = stats(dec.endorse);
    results.decompose_orderCommit = stats(dec.orderCommit);
    console.log('decompose', JSON.stringify(results.decompose_endorse), JSON.stringify(results.decompose_orderCommit));

    // concurrent submission: 300 transactions, 50 in flight
    async function concurrent(total, conc) {
        let idx = 0; const lat = [];
        const t0 = process.hrtime.bigint();
        async function worker(w) {
            for (;;) {
                const i = idx++; if (i >= total) return;
                const s = process.hrtime.bigint();
                await contract.submitTransaction('requestValidation',
                    `0xconc-${R}-${w}-${i}`, 'FI1', new Date().toISOString());
                lat.push(Number(process.hrtime.bigint() - s) / 1e6);
            }
        }
        await Promise.all(Array.from({ length: conc }, (_, w) => worker(w)));
        const wall = Number(process.hrtime.bigint() - t0) / 1e9;
        return { total, conc, wall_s: +wall.toFixed(2), tps: +(total / wall).toFixed(1), latency: stats(lat) };
    }
    results.concurrent = await concurrent(300, 50);
    console.log('concurrent', JSON.stringify(results.concurrent));

    fs.writeFileSync(path.join(B, 'latency_results.json'), JSON.stringify(results, null, 1));
    console.log('saved');
    gw.close();
}

run().catch(e => { console.error(e); process.exit(1); });
