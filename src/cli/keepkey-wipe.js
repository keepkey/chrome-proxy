#!/usr/bin/env node

var program = require('commander');
var lib = require('./lib.js');
var logger = require('./../logger.js');

program
    .parse(process.argv);

lib.initializeClient();
var client = lib.getClient();

logger.levels(0, program.verbose);

return lib.getClient().wipeDevice()
    .then(lib.waitForMessage("Success", {message: "Device wiped"}))
    .then(function() {
        process.exit();
    })
    .catch(function (failure) {
        console.error(failure);
        process.exit();
    });
