#!/bin/bash
#
# Copyright IBM Corp All Rights Reserved
#
# SPDX-License-Identifier: Apache-2.0
#
# Exit on first error
set -e
docker pull --platform linux/x86_64 hyperledger/fabric-nodeenv:2.4
docker pull --platform linux/x86_64 hyperledger/fabric-javaenv:2.4 
export MSYS_NO_PATHCONV=1
starttime=$(date +%s)
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

# clean out any old identites in the wallets
rm -rf ../wallet/*
rm -rf ../certs/*

# private data collection configuration (override by setting COLLECTION_CONFIG)
export COLLECTION_CONFIG=${COLLECTION_CONFIG:-${PWD}/chaincode/javascript/data/collection_config.json}

# launch network; create channel and join peer to channel
pushd ./test-network
./network.sh down
./network.sh up createChannel -ca -s couchdb
echo ---------------------------------MASUK DINISINIII------------------------------------
# changed default language to js

./network.sh deployCC -ccn eKYC -ccp ../chaincode/javascript/ -ccl javascript -ccep "OR('Org1MSP.peer','Org2MSP.peer')" -cccg "${COLLECTION_CONFIG}"
# -ccep "OR('Org1MSP.peer','Org2MSP.peer')" -cccg ../chaincode/chaincode_private/collection_config.json
popd

echo ---------------------------------SETUP SUCCESSFULLY------------------------------------

# pushd ./api/utils
# node enrollAdmin.js 1 admin1
# node enrollAdmin.js 2 admin2
# node registerUser.js 1 admin1 FI1
# node registerUser.js 2 admin2 FI2
# node populate.js 1 FI1
# popd