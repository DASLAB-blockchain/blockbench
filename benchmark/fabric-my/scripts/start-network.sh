#!/bin/bash

. env.sh

pushd $FABRIC_SAMPLE_PATH/test-network

# modify block size and block wait in configtx.yaml
BATCH_WAIT=$1
BATCH_SIZE=$2

sed -i "s/BatchTimeout:.*/BatchTimeout: ${BATCH_WAIT}s/" configtx/configtx.yaml
sed -i "s/MaxMessageCount:.*/MaxMessageCount: ${BATCH_SIZE}/" configtx/configtx.yaml

./network.sh up createChannel
./network.sh deployCC -ccn kvstore -ccp ${BLOCKBENCH_PATH}/chaincode/kvstore/ -ccl go

