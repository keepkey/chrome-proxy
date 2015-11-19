var featuresService = require('../featuresService.js');
var _ = require('lodash');
var NodePathHelper = require('../NodePathHelper.js');

var client;
var defaultOptions = {
  addressN: []
};

var getPublicKey = function getPublicKey(args) {
  client = this;

  var options = _.extend({}, defaultOptions, args);

  return featuresService.getPromise()
    .then(function (features) {
      if (features.initialized) {
        options.addressN = NodePathHelper.toVector(options.addressN);

        console.log('Normalized node path:', options.addressN);

        var message = new client.protoBuf.GetPublicKey(
          options.addressN
        );
        return client.writeToDevice(message);
      } else {
        return Promise.reject('getPublicKey: device not initialized');
      }
    });
};

module.exports = getPublicKey;
