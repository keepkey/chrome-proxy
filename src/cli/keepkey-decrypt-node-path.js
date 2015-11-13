#!/usr/bin/env node

var _ = require('lodash');
var program = require('commander');
var lib = require('./lib.js');
var ByteBuffer = require('ByteBuffer');
var NodePathHelper = require('../modules/keepkeyjs/NodePathHelper.js');

var value;

program
  .arguments('<encrypted_node_path>')
  .option('-c, --coin-name', 'The name of the cryptocurrency you want to access, values: Bitcoin, default: Bitcoin')
  .option('-p, --remember-pin', 'remember PIN so you don\'t have to re-enter it')
  .option('-v, --verbose', 'Increase verbosity', lib.bumpVerbosity, 40)
  .action(function (encrypted_node_path) {
    value = ByteBuffer.fromHex(encrypted_node_path);
  })
  .parse(process.argv);

var options = {
  addressN: '',
  key: 'node-location',
  value: value
};

lib.initializeClient()
  .then(function (client) {
    return client.decryptKeyValue(options);
  })
  .then(function () {
    var pinEntryPromise = lib.waitForMessage("PinMatrixRequest", {type: 'PinMatrixRequestType_Current'})()
      .then(lib.waitForPin('Enter your PIN'))
      .then(function () {
        return new Promise(function (resolve, reject) {
          lib.waitForMessage("Failure")()
            .then(reject);
        });
      });
    var cipherKeyValueResponsePromise = lib.waitForMessage("CipheredKeyValue")();

    return Promise.race([pinEntryPromise, cipherKeyValueResponsePromise]);
  })
  .then(function (message) {
    message.value.BE();
    var length = message.value.readInt8();
    var nodePath = [];

    for (var i=0; i<length; i++) {
      nodePath.push(message.value.readUint32());
    }

    console.log(NodePathHelper.toString(nodePath));
  })
  .then(function () {
    if (program.rememberPin) {
      return;
    } else {
      return lib.getClientPromise()
        .then(function (client) {
          client.endSession();
        });
    }
  })
  .then(process.exit)
  .catch(function (failure) {
    lib.logger.error(failure);
    process.exit();
  });
