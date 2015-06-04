#!/usr/bin/env node
var package = require('../package.json');
var program = require('commander');
var clientModule = require('./modules/keepkeyjs/client.js');
var _ = require('lodash');
var transport = require('./modules/keepkeyjs/transport.js');
var transportHid = require('./modules/keepkeyjs/transportNodeHid.js');
var featuresService = require('./modules/keepkeyjs/featuresService.js');
var crypto = require('./modules/keepkeyjs/nodeCrypto.js');
var readline = require('readline');

const DEVICES = {
    KEEPKEY: {vendorId: 11044, productId: 1},
    TREZOR: {vendorId: 21324, productId: 1}
};

clientModule.setCrypto(crypto);

var client;

transportHid.onConnect(DEVICES.KEEPKEY,
    function createClientForDevice(deviceTransport) {
        client = clientModule.factory(deviceTransport);

        console.log("connected to:", {
            deviceType: client.getDeviceType(),
            deviceId: deviceTransport.getDeviceId()
        });
    }
);

function waitForMessage(targetMessageType, filter) {
    return function () {
        return new Promise(function (resolve/*, reject*/) {
            client.addListener('DeviceMessage', function (messageType, message) {
                if (messageType === targetMessageType && (!filter || _.some([message], filter))) {
                    resolve();
                }
            });
        });
    };
}

function waitForUserInput(prompt, errorMessage, action) {
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
}

program
    .version(package.version);

program
    .command('wipe')
    .alias('w')
    .description('Delete keys and configurations')
    .action(function () {
        featuresService.getPromise()
            .then(client.wipeDevice)
            .then(waitForMessage("Success", {message: "Device wiped"}))
            .then(process.exit)
            .catch(function (failure) {
                console.error(failure);
                process.exit();
            });
    });


program
    .command('setup <label>')
    .alias('s')
    .description('Initialize your device')
    .option('-r, --display-random', 'display the entropy value')
    .option('-s, --strength <strength>', 'set the length of the private key, values: , default: 128')
    .option('-pass, --passphrase-protection', 'protect your private key with a passphrase (not recommended)')
    .option('-P, --no-pin-protection', 'turn off PIN protection for your device (not recommended)')
    .option('-lang, --language <language>', 'set the language displayed on your device, values: english, default: english')
    .action(function (label, options) {
        var params = {
            display_random: options.displayRandom || false,
            strength: options.strength || 128,
            passphrase_protection: options.passphraseProtection || false,
            pin_protection: !(options.noPinProtection || false),
            language: options.language || 'english',
            label: label
        };

        function waitForPin(prompt) {
            return waitForUserInput(prompt + ": ", "PIN too short, try again.", function(line) {
                return client.pinMatrixAck({pin: line});
            });
        }

        featuresService.getPromise()
            .then(function () {
                client.resetDevice(params);
            })
            .then(waitForMessage("PinMatrixRequest", {type: 'PinMatrixRequestType_NewFirst'}))
            .then(waitForPin("Enter your PIN"))
            .then(waitForMessage("PinMatrixRequest", {type: 'PinMatrixRequestType_NewSecond'}))
            .then(waitForPin("Re-enter your PIN"))
            .then(waitForMessage("Success", {message: "Device reset"}))
            .then(process.exit)
            .catch(function (failure) {
                console.error(failure);
                process.exit();
            });
    });


program.parse(process.argv);


