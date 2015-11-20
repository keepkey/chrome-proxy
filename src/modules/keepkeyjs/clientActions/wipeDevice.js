var walletNodeService = require('../services/walletNodeService.js');
var featuresService = require('../featuresService.js');
var client;

module.exports = function wipeDevice() {
  client = this;

  var message = new client.protoBuf.WipeDevice();
  return client.writeToDevice(message)
    .then(function(response) {
      walletNodeService.clear();
      featuresService.clear();
    })
    .then(client.initialize)
    .catch(function(message) {
      if (message.code !== "Failure_ActionCancelled") {
        return Promise.reject(message);
      }
    });
};