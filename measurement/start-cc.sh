#!/bin/bash
cd "${CHAINCODE_DIR:-$(dirname "$0")/../chaincode/javascript}"
export CHAINCODE_SERVER_ADDRESS=127.0.0.1:9999
export CHAINCODE_ID=ekyc_1.0:7d49bf2faf89775072c73b2ec7b46af2111122171045ab5e67a2e3012603c4bb
exec node node_modules/fabric-shim/cli.js server --chaincode-address $CHAINCODE_SERVER_ADDRESS --chaincode-id $CHAINCODE_ID
