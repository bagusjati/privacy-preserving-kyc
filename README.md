# Privacy-Preserving Know-Your-Customer Process for Decentralized Finance on Permissioned Blockchain

Supplementary code for the article "Privacy-preserving know-your-customer process
for decentralized finance on permissioned blockchain" (under review at PeerJ
Computer Science). The repository contains the Hyperledger Fabric component of
the prototype, the evaluation script of the classification experiments, and the
client that reproduces the ledger latency measurements reported in the article.

## Description

The article presents a KYC process for decentralized finance in which passport
verification runs on the customer device, only an ECIES-encrypted verification
result is stored in a Hyperledger Fabric private data collection, and an XGBoost
classifier screens the transaction history of the applicant wallet. This
repository holds the parts of that work that can be shared and reproduced:

- the eKYC chaincode and its private data collection configuration,
- the Fabric test network scripts of the prototype,
- the measurement configuration used to rebuild the network and measure
  per-operation latency, and
- the Python script that reproduces the classification results and the
  performance figures.

## Dataset Information

The classification experiments use the public Ethereum illicit account dataset
of Farrugia, Ellul, and Azzopardi (4,681 records, 2,179 labeled illicit). The
dataset is not redistributed here. Obtain it with:

```
git clone https://github.com/sfarrugia15/Ethereum_Fraud_Detection
```

The script reads `Ethereum_Fraud_Detection/Account_Stats/Complete.csv` relative
to the repository root. Preprocessing (applied by the script): deduplication by
address (4,676 accounts remain), removal of the two categorical token type
attributes (45 numeric features remain), and zero imputation of missing ERC20
attributes.

## Code Information

| Path | Content |
|---|---|
| `experiment_eval.py` | Reproduces the cross-validation, the nested grid-search check, the holdout confusion matrix, and Figures 4 to 7 of the article. |
| `chaincode/javascript/` | The eKYC chaincode (Node.js, `fabric-contract-api`) with `data/collection_config.json`. Relative to the original prototype, the `_isFinancialInstitution` access check is repaired: the original called it without `await` and without the transaction context, so the check never denied access. |
| `test-network/` | The Fabric test network scripts of the prototype (two additional organizations added through `addOrg3` and `addOrg4`). Generated cryptographic material is removed. The prototype was deployed with `setUp.sh`: Fabric v2.4.7, CouchDB, certificate authorities, channel `mychannel`, endorsement policy `OR('Org1MSP.peer','Org2MSP.peer')`. |
| `measurement/` | Configuration of the rebuilt single-host deployment used for the latency measurements: `crypto-config.yaml`, `configtx.yaml`, start scripts, the shell-based chaincode-as-a-service builder, and `client/bench.js`. `latency_results.json` holds the measured values reported in Table 8. |

## Requirements

Classification experiments:

- Python 3.10 or later
- `pandas`, `numpy`, `scikit-learn` 1.8.0, `xgboost` 3.2.0, `matplotlib`

Ledger measurements:

- Linux x86-64 host
- Hyperledger Fabric v2.4.7 binaries (`peer`, `orderer`, `configtxgen`,
  `cryptogen`, `osnadmin`)
- Node.js 18 or later, `@hyperledger/fabric-gateway`, `@grpc/grpc-js`
- `jq`

## Usage Instructions

Classification results and figures:

```
git clone https://github.com/sfarrugia15/Ethereum_Fraud_Detection
pip install pandas numpy scikit-learn==1.8.0 xgboost==3.2.0 matplotlib
python experiment_eval.py
```

The script prints the cross-validation, nested, and holdout results and writes
`fig3.png` and `fig6.png` to `fig8.png`. Results were produced with seed 42.
Small differences in the holdout confusion matrix can occur under other library
versions.

Latency measurements (summary; the scripts in `measurement/` contain the exact
configuration):

1. Generate crypto material with `cryptogen` from `measurement/crypto-config.yaml`.
2. Generate the channel genesis block with `configtxgen` from
   `measurement/configtx.yaml` (profile `FourOrgsApplicationGenesis`).
3. Start the orderer and the four peers with the start scripts, join the
   channel with `osnadmin` and `peer channel join`.
4. Package the chaincode as a chaincode-as-a-service package, install, approve,
   and commit it with the endorsement policy and collection configuration
   above, then run `measurement/start-cc.sh`.
5. Bootstrap the approved institution list
   (`addApprovedFinancialInstitution`) and run
   `node measurement/client/bench.js` (`npm install @hyperledger/fabric-gateway`
   first). Paths, ports, and test sizes are read from `params.conf` at the
   repository root and can be adapted there.

## Methodology

Classification: repeated stratified five-fold cross-validation with ten
repetitions (fifty folds, seed 42) for random forest and XGBoost, a nested
check with the grid search embedded in each training fold, and one stratified
86/14 holdout split for the confusion matrix and per-class metrics.

Latency: the network of the prototype is rebuilt as native processes on one
host (one orderer, four organizations with one peer each, LevelDB, TLS
enabled, chaincode as an external service). Writes are measured through the
Fabric Gateway submit path (endorse, order, commit) and reads through the
evaluate path, 100 measurements per operation after ten warmup calls, plus an
endorse/commit decomposition and a concurrent submission test (300
transactions, 50 in flight).

## Citations

If you use this code, please cite the article (citation will be added upon
publication). The dataset is from:

> S. Farrugia, J. Ellul, G. Azzopardi, "Detection of illicit accounts over the
> Ethereum blockchain," Expert Systems with Applications, vol. 150, 2020,
> Art. 113318. https://doi.org/10.1016/j.eswa.2020.113318

## License & Contribution

The chaincode and network scripts derive from Hyperledger Fabric samples and
are provided under the Apache License 2.0, which also covers the rest of this
repository. The repository accompanies a research article and is not actively
seeking contributions. Questions can be addressed to the corresponding author
(bagus@if.its.ac.id).
