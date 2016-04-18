#!/usr/bin/env node

var _ = require('lodash');
var program = require('commander');
var lib = require('./lib.js');
var ByteBuffer = require('bytebuffer');

const HARDENED_ZERO = 0x80000000;

var addressN, message, publicKey;

program
  .arguments('<address_n> <message> <public_key>')
  .option('-d, --display-only', 'show just on display? (don\'t send back via wire)')
  .option('-c, --coin-name', 'The name of the cryptocurrency you want to access, values: Bitcoin, default: Bitcoin')
  .option('-p, --remember-pin', 'remember PIN so you don\'t have to re-enter it')
  .option('-v, --verbose', 'Increase verbosity', lib.bumpVerbosity, 40)
  .action(function (address_n, msg, public_key) {
    addressN = address_n;
    message = msg;
    publicKey = public_key;
  })
  .parse(process.argv);

var options = {
  addressN: addressN,
  message: ByteBuffer.wrap(message),
  coinName: program.coinName || 'Bitcoin',
  publicKey: ByteBuffer.fromHex(publicKey),
  displayOnly: false
};

lib.initializeClient()
  .then(function (client) {
    return client.encryptMessage(options);
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
    var encryptMessageResponsePromise = lib.waitForMessage("EncryptedMessage")();

    return Promise.race([pinEntryPromise, encryptMessageResponsePromise]);
  })
  .then(function (message) {
    console.log('nonce:', message.nonce.toHex());
    console.log('message:', message.message.toHex());
    console.log('hmac:', message.hmac.toHex());
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
