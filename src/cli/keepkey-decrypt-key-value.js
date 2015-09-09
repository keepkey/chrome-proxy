#!/usr/bin/env node

var _ = require('lodash');
var program = require('commander');
var lib = require('./lib.js');
var ByteBuffer = require('ByteBuffer');

var addressN, key, value;

program
  .arguments('<address_n> <key> <value>')
  .option('-c, --coin-name', 'The name of the cryptocurrency you want to access, values: Bitcoin, default: Bitcoin')
  .option('-p, --remember-pin', 'remember PIN so you don\'t have to re-enter it')
  .option('-v, --verbose', 'Increase verbosity', lib.bumpVerbosity, 40)
  .action(function (address_n, config_key, config_value) {
    addressN = address_n;
    key = config_key;
    value = ByteBuffer.fromHex(config_value);
  })
  .parse(process.argv);

var options = {
  addressN: addressN,
  key: key,
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
    console.log(message.value.toUTF8().trim());
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
