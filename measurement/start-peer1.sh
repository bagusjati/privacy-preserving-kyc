#!/bin/bash
# Jalankan peer Org1 sebagai proses native. / Start the Org1 peer as a native process.
source "$(dirname "$0")/../load-config.sh"
B=$BENCH_DIR
PEER=$B/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com
export FABRIC_CFG_PATH=$B/peer1/cfg
export CORE_PEER_ID=peer0.org1.example.com
export CORE_PEER_ADDRESS=$NODE_HOST:$PEER1_PORT
export CORE_PEER_LISTENADDRESS=$NODE_HOST:$PEER1_PORT
export CORE_PEER_CHAINCODEADDRESS=$NODE_HOST:$PEER1_CHAINCODE_PORT
export CORE_PEER_CHAINCODELISTENADDRESS=$NODE_HOST:$PEER1_CHAINCODE_PORT
export CORE_PEER_GOSSIP_BOOTSTRAP=$NODE_HOST:$PEER1_PORT
export CORE_PEER_GOSSIP_EXTERNALENDPOINT=$NODE_HOST:$PEER1_PORT
export CORE_PEER_LOCALMSPID=Org1MSP
export CORE_PEER_MSPCONFIGPATH=$PEER/msp
# TLS aktif. / TLS enabled.
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_CERT_FILE=$PEER/tls/server.crt
export CORE_PEER_TLS_KEY_FILE=$PEER/tls/server.key
export CORE_PEER_TLS_ROOTCERT_FILE=$PEER/tls/ca.crt
export CORE_PEER_FILESYSTEMPATH=$B/peer1/data
export CORE_OPERATIONS_LISTENADDRESS=$NODE_HOST:$PEER1_OPS_PORT
export CORE_METRICS_PROVIDER=disabled
exec "$FABRIC_BIN/peer" node start
