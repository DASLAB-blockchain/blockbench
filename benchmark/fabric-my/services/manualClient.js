'use strict';

const {Gateway, Wallets, DefaultEventHandlerStrategies} = require('fabric-network');
const fs = require('fs');
const path = require('path');
const common = require('./common')

if (process.argv.length < 4) {
    console.error(`Too few arguments, expect at least 2`);
    helper();
    process.exit(1);
}

function helper() {
    console.error("Expected usage: ")
    console.error("\tnode manualClient.js <Operation> <value1> <value2>")
}

const operation = process.argv[2];
const value1 = process.argv[3];
const value2 = process.argv[4];

common.getContract('mychannel', 'kvstore').then((contract) => {
    let start;
    let txn;
    new Promise((resolve) => {
        start = new Date()
        txn = contract.createTransaction(operation);
        switch (operation) {
            case 'Read':
            case 'Del':
                resolve(txn.submit(value1))
                break;
            case 'Write':
                resolve(txn.submit(value1, value2))
                break;
            default:
                throw "Unrecognized Operation";
        }
    }).then((result) => {
        let end = new Date() - start
        const txnID = txn.getTransactionId();
        console.log(`Transaction ${operation} ${txnID} executed with latency ${end}`);
    }).catch((error) => {
        console.error(`Failed to invoke with error: ${error}`);
    });
});