var featuresService = require('../featuresService.js');
var _ = require('lodash');
var NodePathHelper = require('../NodePathHelper.js');
var ByteBuffer = require('bytebuffer');
var logger = require('../../../logger.js');

var client;
var defaultOptions = {
  addressN: [0],
  key: '',
  value: ByteBuffer.wrap(''),
  encrypt: true,
  ask_on_encrypt: false,
  ask_on_decypt: false
};

function padToMultipleOf16(buffer) {
  var paddingSize = 16 - (buffer.limit % 16);
  var padding = ByteBuffer.allocate(paddingSize).fill(0).reset();
  buffer.resize(buffer.limit + padding.limit).append(padding, buffer.limit).reset();
  buffer.limit = buffer.limit + padding.limit;
  return buffer;
}

var encryptKeyValue = function encryptKeyValue(args) {
  client = this;

  var options = _.extend({}, defaultOptions, args);

  return featuresService.getPromise()
    .then(function (features) {
      if (features.initialized) {
        options.addressN = NodePathHelper.toVector(options.addressN);

        logger.info('Normalized node path:', options.addressN);

        var message = new client.protoBuf.CipherKeyValue(
          options.addressN,
          options.key,
          padToMultipleOf16(options.value),
          options.encrypt,
          options.ask_on_encrypt,
          options.ask_on_decypt
        );
        return client.writeToDevice(message);
      } else {
        return Promise.reject('device not initialized');
      }
    });
};

module.exports = encryptKeyValue;
