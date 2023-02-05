#!/bin/bash

. env.sh

pushd $FABRIC_SAMPLE_PATH/test-network
./network.sh down

