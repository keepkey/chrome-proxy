#!/usr/bin/env node

var _ = require('lodash');
var program = require('commander');
var lib = require('./lib.js');
var ByteBuffer = require('ByteBuffer');
var NodePathHelper = require('../modules/keepkeyjs/NodePathHelper.js');
var addressN;
var assert = require('assert');

program
  .arguments('<address_n>')
  .option('-c, --coin-name', 'The name of the cryptocurrency you want to access, values: Bitcoin, default: Bitcoin')
  .option('-p, --remember-pin', 'remember PIN so you don\'t have to re-enter it')
  .option('-v, --verbose', 'Increase verbosity', lib.bumpVerbosity, 40)
  .action(function (address_n) {
    addressN = address_n;
  })
  .parse(process.argv);

var options = {
  addressN: '',
  key: 'node-location'
};

var normalizedNodeVector = NodePathHelper.toVector(addressN) || [];

var buffer = ByteBuffer.allocate(normalizedNodeVector.length * 4 + 1);
buffer.writeInt8(normalizedNodeVector.length);
normalizedNodeVector.forEach(function(it) {
  buffer.writeUint32(it);
});
options.value = buffer.reset();

lib.initializeClient()
  .then(function (client) {
    return client.encryptKeyValue(options);
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
    message.value.compact();

    //var encoded = ByteBuffer.btoa(hash.sha256(message.value.buffer));
    var encoded = ByteBuffer.btoa(message.value.buffer);
    console.log(encoded.substring(0, 24));

    var encryptedNodePath = message.value.toHex();
    var decodedEncryptedNodePath = ByteBuffer.fromBinary(ByteBuffer.atob(encoded)).toHex();

    assert.equal(
      encryptedNodePath, decodedEncryptedNodePath,
      'encoded wallet id should be decodable to the encrypted node path'
    );
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
