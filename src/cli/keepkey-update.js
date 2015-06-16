#!/usr/bin/env node

var program = require('commander');
var lib = require('./lib.js');

program
    .option('-f, --firmware-file', 'the firmware file to be uploaded (defaults to bin/keepkey_main.bin)')
    .option('-v, --verbose', 'Increase verbosity', lib.bumpVerbosity, 40)
    .parse(process.argv);

lib.initializeClient();
var client = lib.getClient();

var params = {
    firmwareFile: program.firmwareFile || '../../bin/keepkey_main.bin' //TODO Specifying the file name should work correctly.
};

lib.getClient().firmwareUpdate(params)
    .then(lib.waitForMessage("Success", {message: "Upload complete"}))
    .then(client.endSession)
    .then(process.exit)
    .catch(function (failure) {
        console.error(failure);
        process.exit();
    });


