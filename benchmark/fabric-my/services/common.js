'use strict'

const {Gateway, Wallets, DefaultEventHandlerStrategies} = require('fabric-network');
const fs = require('fs');
const path = require('path');

const test_network_path = '/Users/harper/fabric/fabric-samples/test-network';

module.exports = {getContract, getNetwork, test_network_path}

async function getContract(channelName, contractName, mode) {
    try {
        // Get the network (channel) our contract is deployed to.
        const network = await getNetwork(channelName, mode);

        // Get the contract from the network.
        const contract = network.getContract(contractName);
        console.log(`Contract ${contractName} on Channel ${channelName} has been setup... }`);
        return contract;
    } catch (error) {
        console.error(`Failed to set up the contract and channel: ${error}`);
        process.exit(1);
    }
}

async function getNetwork(channelName, mode) {
    try {
        // load the network configuration
        const ccpPath = path.resolve(test_network_path, 'organizations', 'peerOrganizations', 'org1.example.com', 'connection-org1.json');
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
        if (mode != undefined) {
            await gateway.connect(ccp,
                {
                    wallet, identity: 'appUser',
                    discovery: {enabled: true, asLocalhost: true},
                    eventHandlerOptions: {
                        strategy: mode
                    }
                });
        } else {
            await gateway.connect(ccp,
                {
                    wallet, identity: 'appUser',
                    discovery: {enabled: true, asLocalhost: true}
                });
        }

        // Get the network (channel) our contract is deployed to.
        const network = await gateway.getNetwork(channelName);
        console.log(`Channel ${channelName} has been setup... }`);
        return network;
    } catch (error) {
        console.error(`Failed to set up the contract and channel: ${error}`);
        process.exit(1);
    }
}