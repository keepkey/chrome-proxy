var featuresService = require('../featuresService.js');
var _ = require('lodash');
var NodePathHelper = require('../NodePathHelper.js');
var ByteBuffer = require('bytebuffer');
var logger = require('../../../logger.js');

var client;
var defaultOptions = {
  addressN: [0],
  message: ''
};

var signMessage = function signMessage(args) {
  client = this;

  var options = _.extend({}, defaultOptions, args);

  return featuresService.getPromise()
    .then(function (features) {
      if (features.initialized) {
        options.addressN = NodePathHelper.toVector(options.addressN);

        logger.info('Normalized node path:', options.addressN);

        var message = new client.protoBuf.SignMessage(
          options.addressN,
          options.message,
          options.coinName
        );
        return client.writeToDevice(message);
      } else {
        return Promise.reject('device not initialized');
      }
    });
};

module.exports = signMessage;
