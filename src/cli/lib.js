var _ = require('lodash');
var readline = require('readline');
var transportHid = require('./../modules/keepkeyjs/node/nodeTransportHid.js');
var clientModule = require('./../modules/keepkeyjs/client.js');
var logger = require('./../logger.js');
const DEVICES = {
    KEEPKEY: {vendorId: 11044, productId: 1}
};

var client;
var clientPromise;

var lib = {
    initializeClient: function initializeClient() {
        clientPromise = new Promise(function(resolve, reject) {
            transportHid.onConnect(DEVICES.KEEPKEY,
                function createClientForDevice(deviceTransport) {
                    client = clientModule.factory(deviceTransport);

                    client.readFirmwareFile = require('./../modules/keepkeyjs/node/nodeReadFirmwareFile.js');
                    client.crypto = require('./../modules/keepkeyjs/node/nodeCrypto.js');

                    console.log("connected to:", client.getDeviceType());

                    resolve(client);
                }
            );
        });
        return clientPromise
            .then(function(client) {
                lib.waitForMessage('Failure')()
                    .then(function(message) {
                        console.log('FAILURE! %s',message.message);
                        process.exit();
                    });
                return client;
            });
    },

    getClientPromise: function getClientPromise() {
        return clientPromise;
    },

    waitForMessage: function waitForMessage(targetMessageType, filter) {
        return function () {
            return new Promise(function (resolve/*, reject*/) {
                client.addListener('DeviceMessage', function (messageType, message) {
                    if (messageType === targetMessageType && (!filter || _.some([message], filter))) {
                        resolve(message);
                    }
                });
            });
        };
    },

    waitForUserInput: function waitForUserInput(prompt, errorMessage, action) {
        return function () {
            var rl = readline.createInterface(process.stdin, process.stdout);
            return new Promise(function (resolve, reject) {
                rl.setPrompt(prompt);
                rl.prompt();
                rl.on('line', function (line) {
                    line = line.trim();
                    if (line.length) {
                        rl.close();
                        resolve(action(line));
                    } else {
                        console.log(errorMessage);
                        rl.prompt();
                    }
                });
            });
        };
    },

    waitForPin: function waitForPin(prompt) {
        return module.exports.waitForUserInput(prompt + ": ", "PIN too short, try again.", function (line) {
            return client.pinMatrixAck({pin: line});
        });
    },
    bumpVerbosity: function verbosity(v, total) {
        var newVerbosityLevel = total - 10;

        logger.levels(0, newVerbosityLevel);
        return newVerbosityLevel;
    }
};

module.exports = lib;