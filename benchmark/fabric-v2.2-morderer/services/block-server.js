/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { Gateway, Wallets, DefaultEventHandlerStrategies  } = require('fabric-network');
const fs = require('fs');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const protobuf = require('protobufjs');
const { protos } = require('fabric-protos');


const argsLen = process.argv.length;
if ( argsLen <= 3) {
    console.error(`Too few arguments, expect 4`);
    console.error("Expected usage: ")
    console.error("\tnode block-server.js <channelName> <port>")
    process.exit(1);
}
const channelName = process.argv[2];
const port = Number(process.argv[3]);
var blkTxns = {};
var height = 0;

async function getChannel(channelName) {
    try {
        // load the network configuration
        const ccpPath = path.resolve(__dirname, '..', 'organizations', 'peerOrganizations', 'org1.example.com', 'connection-org1.json');
        let ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        // Create a new file system based wallet for managing identities.
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        // console.log(`Wallet path: ${walletPath}`);

        // Check to see if we've already enrolled the user.
        const identity = await wallet.get('appUser');
        if (!identity) {
            console.log('An identity for the user "appUser" does not exist in the wallet');
            console.log('Run the registerUser.js application before retrying');
            return;
        }

        // Create a new gateway for connecting to our peer node.
        const gateway = new Gateway();
        await gateway.connect(ccp, 
            { 
            wallet, identity: 'appUser', 
            discovery: { enabled: true, asLocalhost: true}, 
        });

        // Get the network (channel) our contract is deployed to.
        const network = await gateway.getNetwork(channelName);
        console.log('Weifan change')
        console.log(`Channel ${channelName} has been setup... }`);
        return network;

    } catch (error) {
        console.log('Weifan change')
        console.error(`Failed to set up the contract and channel: ${error}`);
        process.exit(1);
    }
}

function get_all_keys_in_object(obj) {
    var keys = [];
    for (var key in obj) {
        keys.push(key);
    }
    return keys.toString();
}

getChannel(channelName).then((network)=>{
    const listener = async (event) => {
        try {
            height = Number(event.blockNumber) + 1;
            const blkNum = "" + event.blockNumber; //conver to str
            const block = event.blockData;
            blkTxns[blkNum] = [];

            // console.log(block);
            // console.log("" + block.data.data.length);
            // console.log("" + block.metadata.metadata[0].length);
            // console.log("" + block.metadata.metadata[2].length);

            // console.log("---")
            // console.log(block.metadata.metadata[0].toString());
            // console.log(block.metadata.metadata[2].toString());

            // console.log(get_all_keys_in_object(block.metadata.metadata[0][0]));

            // Let's print the transaction filters

            let tx_filters = block.metadata.metadata[2]

            // console.log("Transaction Filters: " + tx_filters.toString());

            // console.log(block);
            const now = new Date();
            console.log('[Weifan change] parsing block ' + blkNum +"; Time " + now.toLocaleTimeString());

            for (var index = 0; index < block.data.data.length; index++) {  // iterate through transactions within the block
                var channel_header = block.data.data[index].payload.header.channel_header;

                // lets' print channel header?
                // console.log('Transaction ' + index + ' channel header');
                // console.log(channel_header);

                if (tx_filters[index] === 0) {
                    blkTxns[blkNum].push(channel_header.tx_id);
                }

                console.log('[Weifan change] transaction ' + channel_header.tx_id);
                // log transaction details
                const blockData = block.data.data[index].payload.data;
                for (var actionIndex = 0; actionIndex < blockData.actions.length; actionIndex ++) {
                    const actionPayload = blockData.actions[actionIndex].payload;
                    const chaincodeSpec = actionPayload.chaincode_proposal_payload.input.chaincode_spec;
                    const inputArgs = chaincodeSpec.input.args;

                    const arg0 = inputArgs[0].toString();
                    const arg1 = inputArgs[1].toString();
                    const arg2 = inputArgs[2].toString();

                    console.log('[Weifan change] action '+actionIndex.toString()+' '+arg0+' '+arg1+' '+arg2);
                }

                /*
                const blockActionPayload = blockData.actions[0].payload;
                const chaincodeSpec = blockActionPayload.chaincode_proposal_payload.input.chaincode_spec;

                // console.log(chaincodeSpec.action.proposal_response.payload.proposal_hash.toString());
                // console.log(chaincodeSpec);

                const inputArgs = chaincodeSpec.input.args;

                const arg0 = inputArgs[0].toString();
                const arg1 = inputArgs[1].toString();
                const arg2 = inputArgs[2].toString();

                const transactionPayload = blockActionPayload.action.proposal_response_payload;
                //const rwset = transactionPayload.extension.results.ns_rwset;

                if (transactionPayload.extension.results.ns_rwset === undefined) {
                    continue;
                } else {
                    // const action1 = transactionPayload.extension.results.ns_rwset[0].rwset.reads;
                    // console.log(action1);
                    const action2 = transactionPayload.extension.results.ns_rwset[1].rwset.writes[0];
                    const action2_value_string = Buffer.from(action2.value).toString();

                    // console.log(action2_value_string);
                }

                console.log(arg0 + " " + arg1 + " " + arg2)
                */

                /*
                console.log(blockData.actions.length);
                console.log(blockData.actions[0].header);
                console.log(blockData.actions[0].payload);
                */
               

                // const encoded_data = block.data.data[index].payload.data.actions[0].payload.chaincode_proposal_payload.input.args;
                // const decoded_data = BlockDecoder.decode(encoded_data);
                // console.log(block.data.data[index].payload.data.actions[0].payload.chaincode_proposal_payload.input);

                // const transaction = block.data.data[index];
                // console.log('Transaction ' + index + get_all_keys_in_object(transaction));

                // console.log("---");
                // console.log("Transaction " + index);
                /*
                console.log(transaction.signature);
                console.log(transaction.payload.header);
                console.log(transaction.payload.data);  // { actions: [ { header: [Object], payload: [Object] } ] }
                */

                // check the header and payload for each action:
                // const actions = transaction.payload.data.actions;
                // console.log(actions.length + " actions");

                // console.log(actions[0].header);
                // console.log(actions[0].payload.chaincode_proposal_payload.input.chaincode_spec);
                // console.log(actions[0].payload.action.endorsements[0]);

                /*
                if (index === 0) {
                    // console.log(block.data.data[index]);
                    // console.log(block.data.data[index].payload.header);
                    // console.log('---');
                    // console.log(block.data.data[index].payload.data);

                    // Check bock actions data
                    var block_payload_data = block.data.data[index].payload.data;
                    console.log('Payload action length: ' + block_payload_data.actions.length);

                    var action = block_payload_data.actions[0];
                    console.log(action.header);
                    console.log('---');
                    console.log(action.payload);

                    // check action payload
                    console.log(action.payload.action.proposal_response_payload.extension);
                    console.log('---');
                    console.log(action.payload.action.endorsements.length);
                    console.log(action.payload.action.endorsements[0]);

                }
                */


                // Check the content of request on block server side
                // var blkKeys = [];
                // for (var key in block.data.data[index]) {
                //     blkKeys.push(key);
                // }
                // console.log(blkKeys.toString());

                // signature
                // MOST LIKELY PART THAT CONTAINS TRANSACTION INFO

                /*
                var blkKeys = [];
                  for (var key in block.data.data[index].signature) {
                    blkKeys.push(key);
                }
                console.log(blkKeys.toString());
                var blkVals = [];
                for (var key in blkKeys) {
                    blkVals.push(block.data.data[index].signature[key]);
                }
                console.log(blkVals.toString());
                */
                // console.log(block.data.data[index].signature);
                // const buf = Buffer.from(block.data.data[index].signature);
                // console.log(buf.toString());


                // console.log(block.data.data[index].payload.header.channel_header);
                // console.log('-----')
                // console.log(block.data.data[index].payload.header.signature_header);

                // console.log(block.data.data[index].payload.data);

                // payload.header

                // payload.data
                // console.log(block.data.data[index].payload.data)

            }
            // console.log(`[Weifan change] Block ${blkNum} has txns [${blkTxns[blkNum]}]. `);

        } catch (error) {
            console.error(`Failed to listen for blocks: ${error}`);
        }
    };
    return network.addBlockListener(listener, {startBlock: 1});
}).then(()=>{
    const app = express();

    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    })

    // app.use(bodyParser.json());

    app.get("/block", (req, res) => { 
        const blkNum = "" + req.query.num; //convert to string
        // console.log(req);
        const txns = blkTxns[blkNum];
        if (txns === undefined) {
            res.json({"status": "1", "message": "Block " + blkNum + " does not exist. "});
        } else {
            res.json({"status": "0", "txns": txns});
        }
    });

    app.get("/height", (req, res) => { 
        res.json({"status": "0", "height": "" + height});
    });
}).catch((error)=>{
    console.log('Weifan change')
    console.error(`Failed to set up the contract and channel: ${error}`);
    process.exit(1);

})
