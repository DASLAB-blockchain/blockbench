/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const express = require('express');
const bodyParser = require('body-parser');

const argsLen = process.argv.length;

function helper() {
    console.error("Expected usage: ")
    console.error("\tnode txn-server.js <port>")
    console.error("\tThe 'open_loop' indicates the invocation will return once the transaction is submitted to orderers. The 'closed_loop' will block until peers finish validation. Their configuration may impact on invocation transactions, not on queries. ")

}

if (argsLen < 1) {
    console.error(`Too few arguments, expect 1`);
    helper();
    process.exit(1);
}

const port = Number(process.argv[1]);

const app = express();
app.listen(port, () => {
    console.log(`Server running on port ${port}.`);
})
app.use(bodyParser.json());

app.post("/invoke", (req, res) => {
    const funcName = req.body["function"];
    const args = req.body["args"];
    console.log(`Receive funcName: ${funcName}, args: ${args}`);
    res.json({"status": "0", "txnID": 0, "latency_ms": 0});
});

app.get("/query", (req, res) => {
    const funcName = req.query.function;
    const args = req.query.args.split(',');
    console.log(`Receive funcName: ${funcName}, args: ${args}`);
});
