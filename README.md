# Privacy-preserving KYC prototype: supplementary code

Supplementary material for "Privacy-preserving know your customer process for
decentralized finance on permissioned blockchain".

## Contents

- `chaincode/javascript/` - the eKYC chaincode (Node.js, fabric-contract-api)
  with its private data collection configuration
  (`data/collection_config.json`). Relative to the original prototype, the
  `_isFinancialInstitution` access check is repaired: the original code called
  it without `await` and without the transaction context, so the check never
  denied access. The repaired version enforces the approved institution list.
- `test-network/` - the network scripts of the prototype (Fabric test network
  with two additional organizations added through `addOrg3` and `addOrg4`).
  Generated cryptographic material is removed. The prototype was deployed with
  `setUp.sh`: Fabric v2.4.7, CouchDB state database, certificate authorities,
  channel `mychannel`, endorsement policy
  `OR('Org1MSP.peer','Org2MSP.peer')`. The path of the collection
  configuration is read from `COLLECTION_CONFIG` (default
  `chaincode/javascript/data/collection_config.json`).
- `measurement/` - the configuration and client used for the latency
  measurements reported in the article: a native (non-Docker) single-host
  deployment of the same logical topology (one orderer, four organizations
  with one peer each, LevelDB state database, TLS enabled, chaincode run as
  an external service via the `ccaas-builder`). `client/bench.js` measures
  per-operation latency with the Fabric Gateway API: writes with
  `submitTransaction` (endorse, order, commit) and reads with
  `evaluateTransaction`, plus an endorse/commit decomposition and a
  concurrent submission test. The scripts read the working directory from
  `BENCH_DIR` (default `$HOME/bench`) and the Fabric binaries from
  `FABRIC_BIN` (default `$HOME/fabric-linux/bin`). `configtx.yaml` is expected
  to sit in the working directory next to the generated `organizations/`
  folder.
- `experiment_eval.py` - the evaluation script of the fraud detection models
  reported in the article. It reads the dataset of Farrugia et al. from the
  repository root, so run
  `git clone https://github.com/sfarrugia15/Ethereum_Fraud_Detection` there
  before `python experiment_eval.py`.

## Reproducing the latency measurements

1. Generate crypto material with `cryptogen` from
   `measurement/crypto-config.yaml`.
2. Generate the channel genesis block with `configtxgen` from
   `measurement/configtx.yaml` (profile `FourOrgsApplicationGenesis`).
3. Start the orderer and the four peers with the start scripts, join the
   channel with `osnadmin` and `peer channel join`.
4. Package the chaincode as a chaincode-as-a-service package, install it on
   the peers, approve and commit it with the endorsement policy and the
   collection configuration above, and start `start-cc.sh`.
5. Bootstrap the approved institution list
   (`addApprovedFinancialInstitution`) and run
   `node measurement/client/bench.js`.
