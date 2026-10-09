/*
 * Chaincode eKYC: hasil verifikasi terenkripsi disimpan di koleksi data privat.
 * eKYC chaincode: the encrypted verification result is kept in a private data collection.
 */

const { Contract } = require('fabric-contract-api');

// Profil pengguna dan alamat dompetnya. / User profile and its wallet address.
class UserProfile {
    constructor(userId, ethereumAddress) {
        this.userId = userId;
        this.ethereumAddress = ethereumAddress;
        this.type = 'UserProfile';
    }
}

class KycChaincode extends Contract {

    // Inisialisasi ledger, tanpa data awal. / Initialize the ledger, no seed data.
    async initLedger(ctx) {
        console.info('Initializing the ledger');
    }

    // Simpan data KYC terenkripsi ke koleksi privat. / Store the encrypted KYC data in the private collection.
    async submitKycData(ctx, customerId, encryptedKycData) {
        await ctx.stub.putPrivateData('customerPrivateData', customerId, Buffer.from(encryptedKycData));
    }

    // Baca data KYC, hanya untuk institusi yang disetujui. / Read the KYC data, approved institutions only.
    async getKycData(ctx, customerId, financialInstitution, peerMSPID) {
        if (!(await this._isFinancialInstitution(ctx, financialInstitution, peerMSPID))) {
            throw new Error('Access denied: Only designated financial institutions can access KYC data');
        }

        const privateDataBuffer = await ctx.stub.getPrivateData('customerPrivateData', customerId);
        if (!privateDataBuffer || privateDataBuffer.length === 0) {
            throw new Error(`No KYC data found for customer: ${customerId}`);
        }

        const encryptedData = privateDataBuffer.toString('utf-8');
        return encryptedData;
    }

    // Catat permintaan validasi untuk satu dompet. / Record a validation request for one wallet.
    async requestValidation(ctx, walletAddress, designatedBank, timetsamp) {
        const validationRequest = {
            status: 'pending',
            designatedBank: designatedBank,
            AMLFlag: 'Unchecked',
            timestamp: timetsamp,
        };

        await ctx.stub.putState(walletAddress, Buffer.from(JSON.stringify(validationRequest)));
        return JSON.stringify(validationRequest);
    }

    // Baca permintaan validasi satu dompet. / Read the validation request of one wallet.
    async getRequestValidation(ctx, walletAddress) {
        const validationRequestAsBytes = await ctx.stub.getState(walletAddress);

        if (!validationRequestAsBytes || validationRequestAsBytes.length === 0) {
            throw new Error(`No validation request found for customer: ${walletAddress}`);
        }

        return validationRequestAsBytes.toString('utf-8');
    }

    // Daftar permintaan yang belum diterima untuk satu bank. / List the requests of one bank that are not yet accepted.
    async getRequestsByDesignatedBank(ctx, designatedBank) {
        const iterator = await ctx.stub.getStateByRange('', '');
        const requests = [];

        let result = await iterator.next();
        while (!result.done) {
            const walletAddress = result.value.key;
            const requestAsBytes = result.value.value;
            const request = JSON.parse(requestAsBytes.toString('utf-8'));

            if (request.designatedBank === designatedBank && request.status !== 'accepted') {
                requests.push({
                    walletAddress: walletAddress,
                    request: request,
                });
            }

            result = await iterator.next();
        }
        await iterator.close();

        return JSON.stringify(requests);
    }

    // Tandai hasil penyaringan AML pada permintaan. / Set the AML screening flag on the request.
    async illicitActivities(ctx, walletAddress, illicit, financialInstitution, peerMSPID) {
        if (!(await this._isFinancialInstitution(ctx, financialInstitution, peerMSPID))) {
            throw new Error('Access denied: Only designated financial institutions can access KYC data');
        }
        const validationRequestAsBytes = await ctx.stub.getState(walletAddress);
        if (!validationRequestAsBytes || validationRequestAsBytes.length === 0) {
            throw new Error(`No validation request found for customer: ${walletAddress}`);
        }
        let validationRequest = JSON.parse(validationRequestAsBytes.toString('utf-8'));
        validationRequest.AMLFlag = illicit;
        await ctx.stub.putState(walletAddress, Buffer.from(JSON.stringify(validationRequest)));
        return JSON.stringify(validationRequest);
    }

    // Daftar permintaan yang sudah diterima untuk satu bank. / List the accepted requests of one bank.
    async getAcceptedRequestsByBank(ctx, designatedBank,peerMSPID) {
        if (!(await this._isFinancialInstitution(ctx, designatedBank, peerMSPID))) {
            throw new Error('Access denied: Only designated financial institutions can access KYC data');
        }
        const iterator = await ctx.stub.getStateByRange('', '');
        const acceptedRequests = [];

        let result = await iterator.next();
        while (!result.done) {
            const walletAddress = result.value.key;
            const requestAsBytes = result.value.value;
            const request = JSON.parse(requestAsBytes.toString('utf-8'));

            if (request.designatedBank === designatedBank && request.status === 'accepted') {
                acceptedRequests.push({
                    walletAddress: walletAddress,
                    request: request,
                });
            }

            result = await iterator.next();
        }
        await iterator.close();

        return JSON.stringify(acceptedRequests);
    }

    // Ubah status permintaan validasi. / Update the status of a validation request.
    async validateRequestValidation(ctx, walletAddress, financialInstitution, peerMSPID,status) {
        if (!(await this._isFinancialInstitution(ctx, financialInstitution, peerMSPID))) {
            throw new Error('Access denied: Only designated financial institutions can access KYC data');
        }
        const validationRequestAsBytes = await ctx.stub.getState(walletAddress);

        if (!validationRequestAsBytes || validationRequestAsBytes.length === 0) {
            throw new Error(`No validation request found for customer: ${walletAddress}`);
        }

        let validationRequest = JSON.parse(validationRequestAsBytes.toString('utf-8'));
        validationRequest.status = status;

        await ctx.stub.putState(walletAddress, Buffer.from(JSON.stringify(validationRequest)));
        return JSON.stringify(validationRequest);
    }

    // Cek institusi dan MSP ada di daftar yang disetujui. / Check that the institution and MSP are on the approved list.
    async _isFinancialInstitution(ctx, institution, peerMSPID) {
        const institutionsKey = 'approvedFinancialInstitutions';
        const approvedInstitutionsBytes = await ctx.stub.getState(institutionsKey);
        let approvedFinancialInstitutions = [];

        if (approvedInstitutionsBytes && approvedInstitutionsBytes.length > 0) {
            approvedFinancialInstitutions = JSON.parse(approvedInstitutionsBytes.toString());
        }

        return approvedFinancialInstitutions.some(
            (fi) => fi.institution === institution && fi.mspid === peerMSPID
        );
    }

    // Tambah institusi ke daftar yang disetujui. / Add an institution to the approved list.
    async addApprovedFinancialInstitution(ctx, institution, mspid) {
        const institutionsKey = 'approvedFinancialInstitutions';
        const approvedInstitutionsBytes = await ctx.stub.getState(institutionsKey);
        let approvedFinancialInstitutions = [];

        if (approvedInstitutionsBytes && approvedInstitutionsBytes.length > 0) {
            approvedFinancialInstitutions = JSON.parse(approvedInstitutionsBytes.toString());
        }

        approvedFinancialInstitutions.push({ institution, mspid });
        await ctx.stub.putState(institutionsKey, Buffer.from(JSON.stringify(approvedFinancialInstitutions)));
    }

    // Hapus institusi dari daftar yang disetujui. / Remove an institution from the approved list.
    async removeApprovedFinancialInstitution(ctx, institution, mspid) {
        const institutionsKey = 'approvedFinancialInstitutions';
        const approvedInstitutionsBytes = await ctx.stub.getState(institutionsKey);
        let approvedFinancialInstitutions = [];
        if (approvedInstitutionsBytes && approvedInstitutionsBytes.length > 0) {
            approvedFinancialInstitutions = JSON.parse(approvedInstitutionsBytes.toString());
        }
        approvedFinancialInstitutions = approvedFinancialInstitutions.filter(
            (fi) => !(fi.institution === institution && fi.mspid === mspid)
        );
        await ctx.stub.putState(institutionsKey, Buffer.from(JSON.stringify(approvedFinancialInstitutions)));
    }

    // Baca daftar institusi yang disetujui. / Read the approved institution list.
    async getApprovedFinancialInstitutions(ctx) {
        const institutionsKey = 'approvedFinancialInstitutions';
        const approvedInstitutionsBytes = await ctx.stub.getState(institutionsKey);
        if (!approvedInstitutionsBytes || approvedInstitutionsBytes.length === 0) {
            return 'No approved financial institutions found';
        }
        return JSON.parse(approvedInstitutionsBytes.toString());
    }

    // Buat profil pengguna. / Create a user profile.
    async createUserProfile(ctx, userId, ethereumAddress) {
        const userProfile = new UserProfile(userId, ethereumAddress);
        await ctx.stub.putState(userId, Buffer.from(JSON.stringify(userProfile)));
        return JSON.stringify(userProfile);
    }

    // Baca profil pengguna. / Read a user profile.
    async getUserProfile(ctx, userId) {
        const userProfileBytes = await ctx.stub.getState(userId);
        if (!userProfileBytes || userProfileBytes.length === 0) {
            throw new Error(`UserProfile ${userId} does not exist`);
        }
        return JSON.parse(userProfileBytes.toString());
    }
}

module.exports = KycChaincode;
