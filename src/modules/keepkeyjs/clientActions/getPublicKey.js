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
    requestInProgess = false;
    if (requestQueue.length) {
      var args = requestQueue.pop();
      getPublicKey.call(client, args);
      if (!requestQueue.length) {
        client.eventEmitter.off('DeviceMessage', responseReceived);
      }
    }
  } else if (type === 'Failure') {
    requestInProgess = false;
    requestQueue.length = 0;
    client.eventEmitter.off('DeviceMessage', responseReceived);
  }
};

var getPublicKey = function getPublicKey(args) {
  client = this;

  if (requestInProgess) {
    requestQueue.push(args);
    return;
  }

  requestInProgess = true;
  if (!_.find(client.eventEmitter.listeners('DeviceMessage'), responseReceived)) {
    client.addListener('DeviceMessage', responseReceived);
  }

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
