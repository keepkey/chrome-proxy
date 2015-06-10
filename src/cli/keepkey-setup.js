#!/usr/bin/env node

var program = require('commander');
var lib = require('./lib.js');
var logger = require('./../logger.js');

program
    .option('-r, --display-random', 'display the entropy value')
    .option('-s, --strength <strength>', 'set the length of the private key, values: , default: 128')
    .option('-pass, --passphrase-protection', 'protect your private key with a passphrase (not recommended)')
    .option('-P, --no-pin-protection', 'turn off PIN protection for your device (not recommended)')
    .option('-lang, --language <language>', 'set the language displayed on your device, values: english, default: english')
    .parse(process.argv);

lib.initializeClient();
logger.levels(0, program.verbose);
var params = {
    display_random: program.displayRandom || false,
    strength: parseInt(program.strength) || 128,
    passphrase_protection: program.passphraseProtection || false,
    pin_protection: !(program.noPinProtection || false),
    language: program.language || 'english',
    label: program.args[0]
};

lib.getClient().resetDevice(params)
    .then(lib.waitForMessage("PinMatrixRequest", {type: 'PinMatrixRequestType_NewFirst'}))
    .then(lib.waitForPin("Enter your PIN"))
    .then(lib.waitForMessage("PinMatrixRequest", {type: 'PinMatrixRequestType_NewSecond'}))
    .then(lib.waitForPin("Re-enter your PIN"))
    .then(lib.waitForMessage("Success", {message: "Device reset"}))
    .then(process.exit)
    .catch(function (failure) {
        console.error(failure);
        process.exit();
    });

