#!/bin/bash
#
# Copyright IBM Corp All Rights Reserved
#
# SPDX-License-Identifier: Apache-2.0
#
# Bangun jaringan prototipe lalu pasang chaincode eKYC. / Bring up the prototype network and deploy the eKYC chaincode.
# Berhenti saat ada galat. / Exit on first error.
set -e

# Muat parameter terpusat. / Load the central parameters.
source "$(dirname "$0")/load-config.sh"
cd "$REPO_ROOT"

docker pull --platform linux/x86_64 hyperledger/fabric-nodeenv:2.4
docker pull --platform linux/x86_64 hyperledger/fabric-javaenv:2.4
export MSYS_NO_PATHCONV=1
starttime=$(date +%s)

# Bahasa chaincode, bawaan javascript. / Chaincode language, default javascript.
CC_SRC_LANGUAGE=${1:-"javascript"}
CC_SRC_LANGUAGE=$(echo "$CC_SRC_LANGUAGE" | tr [:upper:] [:lower:])
if [ "$CC_SRC_LANGUAGE" != "go" -a \
  "$CC_SRC_LANGUAGE" != "golang" -a \
  "$CC_SRC_LANGUAGE" != "java" \
  -a "$CC_SRC_LANGUAGE" != "javascript" -a \
  "$CC_SRC_LANGUAGE" != "typescript" ]; then

  echo The chaincode language ${CC_SRC_LANGUAGE} is not supported by this script
  echo Supported chaincode languages are: go, java, javascript, and typescript
  exit 1

fi

# Hapus identitas lama di wallet. / Clean out old identities in the wallets.
rm -rf "${WALLET_DIR:?}"/*
rm -rf "${CERTS_DIR:?}"/*

# Nyalakan jaringan, buat channel, gabungkan peer. / Launch the network, create the channel, join the peers.
pushd ./test-network
./network.sh down
./network.sh up createChannel -c "$CHANNEL_NAME" -ca -s couchdb
echo ---------------------------------NETWORK IS UP------------------------------------

# Pasang chaincode dengan kebijakan endorsement dan koleksi data privat. / Deploy the chaincode with the endorsement policy and the private data collection.
./network.sh deployCC -c "$CHANNEL_NAME" -ccn "$CHAINCODE_NAME" -ccp "$CHAINCODE_DIR" -ccl javascript -ccep "$ENDORSEMENT_POLICY" -cccg "$COLLECTION_CONFIG"
popd

echo ---------------------------------SETUP SUCCESSFULLY------------------------------------

# Langkah API prototipe, tidak disertakan di repo ini. / Prototype API steps, not included in this repository.
# pushd ./api/utils
# node enrollAdmin.js 1 admin1
# node enrollAdmin.js 2 admin2
# node registerUser.js 1 admin1 FI1
# node registerUser.js 2 admin2 FI2
# node populate.js 1 FI1
# popd
