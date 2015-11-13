var featuresService = require('../featuresService.js');
var _ = require('lodash');
var NodePathHelper = require('../NodePathHelper.js');
var ByteBuffer = require('bytebuffer');
var logger = require('../../../logger.js');

var client;
var defaultOptions = {
  addressN: [],
  key: '',
  value: '',
  encrypt: false,
  ask_on_encrypt: false,
  ask_on_decypt: false
};

var decryptKeyValue = function decryptKeyValue(args) {
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
          ByteBuffer.wrap(options.value),
          options.encrypt,
          options.ask_on_encrypt,
          options.ask_on_decypt
        );
        return client.writeToDevice(message);
      } else {
        return Promise.reject('decryptKeyValue: device not initialized');
      }
    });
};

module.exports = decryptKeyValue;
