#!/usr/bin/env node

var _ = require('lodash');
var program = require('commander');
var lib = require('./lib.js');
var ByteBuffer = require('bytebuffer');

const HARDENED_ZERO = 0x80000000;

program
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
    addressN: addressN
};

lib.initializeClient()
    .then(function (client) {
        client.getPublicKey(options)
            .then(function () {
                var pinEntryPromise = lib.waitForMessage("PinMatrixRequest", {type: 'PinMatrixRequestType_Current'})()
                    .then(lib.waitForPin('Enter your PIN'))
                    .then(function () {
                        return new Promise(function (resolve, reject) {
                            lib.waitForMessage("Failure")()
                                .then(reject);
                        });
                    });
                var publicKeyResponsePromise = lib.waitForMessage("PublicKey")();

                return Promise.race([pinEntryPromise, publicKeyResponsePromise]);
            })
            .then(function (message) {
                var node = {
                    depth: message.node.depth,
                    fingerprint: message.node.fingerprint,
                    child_num: message.node.child_num,
                    chain_code: message.node.chain_code.toHex(),
                    public_key: message.node.public_key.toHex(),
                    private_key: message.node.private_key
                };

                console.log('node:', JSON.stringify(node, null, 4));
                console.log('xpub:', message.xpub);
            })
            .then(function () {
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
    });


