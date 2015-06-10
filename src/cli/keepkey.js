#!/usr/bin/env node
var package = require('../../package.json');
var program = require('commander');

program
    .version(package.version)
    .option('-v, --verbose', 'Increase verbosity', function verbosity(v, total) {
        // TODO Verbosity isn't working.
        return total - 10;
    }, 40)
    .command('wipe', 'Delete keys and configurations')
    .command('setup <label>', 'Initialize your device')
    .command('update', 'Update firmware')
    .command('address <address_n...>', 'Get a public address')
    .parse(process.argv);

if (!program.args.length) {
    program.outputHelp();
    process.exit();
}
