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

                return client.writeToDevice(message);
            } else {
                return Promise.reject('Expected device to be unitialized. Run WipeDevice and try again.');
            }

        })
        .catch(function(failure) {
            logger.error("ResetDevice failed:", failure);
            return Promise.reject(failure);
        });
};