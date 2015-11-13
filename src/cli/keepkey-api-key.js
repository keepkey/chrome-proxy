#!/usr/bin/env node

var _ = require('lodash');
var program = require('commander');
var lib = require('./lib.js');
var ByteBuffer = require('ByteBuffer');

program
  .option('-c, --coin-name', 'The name of the cryptocurrency you want to access, values: Bitcoin, default: Bitcoin')
  .option('-p, --remember-pin', 'remember PIN so you don\'t have to re-enter it')
  .option('-v, --verbose', 'Increase verbosity', lib.bumpVerbosity, 40)
  .parse(process.argv);

var client;

lib.initializeClient()
  .then(function(cl) {
    client = cl;
    return client.getPublicKey({
      addressN: []
    });
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
    var publicKeyPromise = lib.waitForMessage("PublicKey")();

    return Promise.race([pinEntryPromise, publicKeyPromise]);
  })
  .then(function(message) {
    var publicKey = message.node.public_key;
    console.log('publicKey:', publicKey.toHex());

    client.encryptKeyValue({
      addressN: [],
      key: 'api-key',
      value: publicKey
    });
    return lib.waitForMessage('CipheredKeyValue')();
  })
  .then(function (message) {
    message.value.compact();
    var encoded = ByteBuffer.btoa(message.value.buffer);
    var apiKey = 'KPKY' + encoded;
    console.log(apiKey);
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
