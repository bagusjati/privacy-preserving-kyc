#!/bin/bash
# Jalankan chaincode sebagai layanan eksternal. / Run the chaincode as an external service.
source "$(dirname "$0")/../load-config.sh"
cd "$CHAINCODE_DIR"
export CHAINCODE_SERVER_ADDRESS CHAINCODE_ID
exec node node_modules/fabric-shim/cli.js server --chaincode-address "$CHAINCODE_SERVER_ADDRESS" --chaincode-id "$CHAINCODE_ID"
