#!/bin/bash
B=${BENCH_DIR:-$HOME/bench}
export FABRIC_CFG_PATH=$B/peer1/cfg
export CORE_PEER_ID=peer0.org1.example.com
export CORE_PEER_ADDRESS=127.0.0.1:7051
export CORE_PEER_LISTENADDRESS=127.0.0.1:7051
export CORE_PEER_CHAINCODEADDRESS=127.0.0.1:7052
export CORE_PEER_CHAINCODELISTENADDRESS=127.0.0.1:7052
export CORE_PEER_GOSSIP_BOOTSTRAP=127.0.0.1:7051
export CORE_PEER_GOSSIP_EXTERNALENDPOINT=127.0.0.1:7051
export CORE_PEER_LOCALMSPID=Org1MSP
export CORE_PEER_MSPCONFIGPATH=$B/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/msp
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_CERT_FILE=$B/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/server.crt
export CORE_PEER_TLS_KEY_FILE=$B/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/server.key
export CORE_PEER_TLS_ROOTCERT_FILE=$B/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
export CORE_PEER_FILESYSTEMPATH=$B/peer1/data
export CORE_OPERATIONS_LISTENADDRESS=127.0.0.1:9444
export CORE_METRICS_PROVIDER=disabled
exec "${FABRIC_BIN:-$HOME/fabric-linux/bin}/peer" node start
