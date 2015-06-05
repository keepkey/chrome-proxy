#!/usr/bin/env node
var package = require('../package.json');
var program = require('commander');
var clientModule = require('./modules/keepkeyjs/client.js');
var _ = require('lodash');
var transport = require('./modules/keepkeyjs/transport.js');
var transportHid = require('./modules/keepkeyjs/node/nodeTransportHid.js');
var featuresService = require('./modules/keepkeyjs/featuresService.js');
var readline = require('readline');
var logger = require('./logger.js');

const DEVICES = {
    KEEPKEY: {vendorId: 11044, productId: 1},
    TREZOR: {vendorId: 21324, productId: 1}
};

var client;

function initializeClient() {
    transportHid.onConnect(DEVICES.KEEPKEY,
        function createClientForDevice(deviceTransport) {
            client = clientModule.factory(deviceTransport);

            client.readFirmwareFile = require('./modules/keepkeyjs/node/nodeReadFirmwareFile.js');
            client.crypto = require('./modules/keepkeyjs/node/nodeCrypto.js');

            console.log("connected to:", client.getDeviceType());
        }
    );
}

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
    .version(package.version)
    .option('-v, --verbose', 'Increase verbosity', function verbosity(v, total) {
        return total - 10;
    }, 40);

program
    .command('wipe')
    .alias('w')
    .description('Delete keys and configurations')
    .action(function (options) {
        initializeClient();
        logger.levels(0, program.verbose);
        return client.wipeDevice()
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
        initializeClient();
        logger.levels(0, program.verbose);
        var params = {
            display_random: options.displayRandom || false,
            strength: options.strength || 128,
            passphrase_protection: options.passphraseProtection || false,
            pin_protection: !(options.noPinProtection || false),
            language: options.language || 'english',
            label: label
        };

        function waitForPin(prompt) {
            return waitForUserInput(prompt + ": ", "PIN too short, try again.", function (line) {
                return client.pinMatrixAck({pin: line});
            });
        }

        return client.resetDevice(params)
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

program
    .command('update')
    .alias('u')
    .description('Update firmware')
    .option('-f, --firmware-file', 'the firmware file to be uploaded (defaults to bin/keepkey_main.bin)')
    .action(function (options) {
        initializeClient();
        logger.levels(0, program.verbose);
        var params = {
            firmwareFile: options.firmwareFile || 'bin/keepkey_main.bin'
        };

        return client.firmwareUpdate(params)
            .then(waitForMessage("Success", {message: "Upload complete"}))
            .then(process.exit)
            .catch(function (failure) {
                console.error(failure);
                process.exit();
            });
    });


program.parse(process.argv);

if (!process.argv.slice(2).length) {
    program.outputHelp();
    process.exit();
}
