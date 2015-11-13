var featuresService = require('../featuresService.js');
var walletNodeService = require('../services/walletNodeService.js');
var logger = require('../../../logger.js');

module.exports = function() {
  var client = this;
  var message = new client.protoBuf.Initialize();

  return client.writeToDevice(message)
    .then(function (featuresMessage) {
      featuresService.setValue(featuresMessage);
      if (featuresMessage.initialized) {
        //TODO This shouldnt be necessary here
        walletNodeService.reloadBalances();
      }
      return featuresMessage;
    })
    .catch(function () {
      logger.error('failure while initializing', arguments);
    });
};