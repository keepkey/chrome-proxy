#!/usr/bin/env node

var _ = require('lodash');
var program = require('commander');
var lib = require('./lib.js');
var ByteBuffer = require('bytebuffer');

const HARDENED_ZERO = 0x80000000;

var addressN, message;

program
  .arguments('<address_n> <message>')
  .option('-c, --coin-name', 'The name of the cryptocurrency you want to access, values: Bitcoin, default: Bitcoin')
  .option('-p, --remember-pin', 'remember PIN so you don\'t have to re-enter it')
  .option('-v, --verbose', 'Increase verbosity', lib.bumpVerbosity, 40)
  .action(function (address_n, msg) {
    addressN = address_n;
    message = ByteBuffer.wrap(msg);
  })
  .parse(process.argv);

var options = {
  addressN: addressN,
  message: message,
  coinName: program.coinName || 'Bitcoin'
};

lib.initializeClient()
  .then(function (client) {
    return client.signMessage(options);
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
    var signMessageResponsePromise = lib.waitForMessage("MessageSignature")();

    return Promise.race([pinEntryPromise, signMessageResponsePromise]);
  })
  .then(function (message) {
    console.log('%s address: %s', options.coinName, message.address);
    console.log('signature:', message.signature.toBase64());
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
    console.error(failure);
    process.exit();
  });
