#!/usr/bin/env node
var package = require('../../package.json');
var program = require('commander');

program
    .version(package.version)
    .command('wipe', 'Delete keys and configurations')
    .command('setup <label>', 'Initialize your device')
    .command('update', 'Update firmware')
    .command('address <address_n...>', 'Get the address for a node')
    .command('public-key <address_n>', 'Get the public key for a node')
    .parse(process.argv);

if (!program.args.length) {
    program.outputHelp();
    process.exit();
}
