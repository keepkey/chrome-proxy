var walletNodeService = require('../services/walletNodeService.js');
var featuresService = require('../featuresService.js');
var client;

module.exports = function wipeDevice() {
  client = this;

  var clearNodesOnSuccess = function(type, message) {
    if (type === "Success") {
      walletNodeService.clear();
      client.eventEmitter.off('DeviceMessage', clearNodesOnSuccess);
      featuresService.clear();
    }
  };

  client.eventEmitter.on('DeviceMessage', clearNodesOnSuccess);
  return client.writeToDevice(new client.protoBuf.WipeDevice());
};