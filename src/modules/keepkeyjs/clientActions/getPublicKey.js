var featuresService = require('../featuresService.js');
var _ = require('lodash');
var NodePathHelper = require('../NodePathHelper.js');

var client;
var defaultOptions = {
  addressN: [0]
};

var requestInProgess = false;
var requestQueue = [];

var responseReceived = function responseReceived(type, message) {
  if (type === 'PublicKey') {
    client.eventEmitter.off('DeviceMessage', responseReceived);
    requestInProgess = false;
    if (requestQueue.length) {
      var args = requestQueue.pop();
      getPublicKey.call(client, args);
    }
  }
};

var getPublicKey = function getPublicKey(args) {
  client = this;

  if (requestInProgess) {
    requestQueue.push(args);
    return;
  }

  requestInProgess = true;
  client.addListener('DeviceMessage', responseReceived);

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
        return Promise.reject('device not initialized');
      }
    });
};

module.exports = getPublicKey;
