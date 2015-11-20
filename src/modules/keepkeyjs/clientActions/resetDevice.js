var featuresService = require('../featuresService.js');
var _ = require('lodash');
var logger = require('../../../logger.js');

var client;
var defaultOptions = {
  display_random: false,
  strength: 128,
  passphrase_protection: false,
  pin_protection: true,
  language: 'english',
  label: null
};

const failureCodes = [
  'Failure_PinCancelled',
  'Failure_ActionCancelled'
];

module.exports = function resetDevice(args) {
  client = this;

  return featuresService.getPromise()
    .then(function (features) {

      if (!features.initialized) {
        var options = _.extend({}, defaultOptions, args);

        var message = new client.protoBuf.ResetDevice(
          options.display_random, options.strength, options.passphrase_protection,
          options.pin_protection, options.language, options.label
        );

        return client.writeToDevice(message)
          .then(client.initialize)
          .catch(function (message) {
            if (_.indexOf(failureCodes, message.code) === -1) {
              return Promise.reject(message);
            }
          });
      } else {
        return Promise.reject('Expected device to be uninitialized. Run WipeDevice and try again.');
      }

    });
};