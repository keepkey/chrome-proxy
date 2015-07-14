#!/usr/bin/env node

var _ = require('lodash');
var program = require('commander');
var lib = require('./lib.js');

const HARDENED_ZERO = 0x80000000;

program
    .option('-c, --coin-name', 'The name of the cryptocurrency you want to access, values: Bitcoin, default: Bitcoin')
    .option('-d, --display', 'Display the address on the device')
    .option('-m, --multisig', 'display a multisig address......, default: false')
    .option('-p, --remember-pin', 'remember PIN so you don\'t have to re-enter it')
    .option('-v, --verbose', 'Increase verbosity', lib.bumpVerbosity, 40)
    .parse(process.argv);

var addressN = program.args;

if (addressN.length === 1) {
    addressN = addressN[0];
}
for (var i = 0, iMax = addressN.length; i < iMax; i++) {
    addressN[i] = parseInt(addressN[i], 10);
}

var options = {
    addressN: addressN,
    coinName: program.coinName || 'Bitcoin',
    showDisplay: program.display || false,
    multisig: program.multisig || false
};

lib.initializeClient()
    .then(function(client) {
        client.getAddress(options);
    })
    .then(function() {
        var pinEntryPromise = lib.waitForMessage("PinMatrixRequest", {type: 'PinMatrixRequestType_Current'})()
            .then(lib.waitForPin('Enter your PIN'))
            .then(function() {
                return new Promise(function(resolve, reject) {
                    lib.waitForMessage("Failure")()
                        .then(reject);
                });
            });
        var addressResponsePromise = lib.waitForMessage("Address")();

        return Promise.race([pinEntryPromise, addressResponsePromise]);
    })
    .then(function (message) {
        console.log('%s address: %s', options.coinName, message.address);
    })
    .then(function() {
        if (program.rememberPin) {
            return;
        } else {
            return lib.getClientPromise()
                .then(function(client) {
                    client.endSession();
                });
        }
    })
    .then(process.exit)
    .catch(function (failure) {
        console.error(failure);
        process.exit();
    });


