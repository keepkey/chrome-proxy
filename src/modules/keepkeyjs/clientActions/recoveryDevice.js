var featuresService = require('../featuresService.js');
var _ = require('lodash');
var logger = require('../../../logger.js');

var client;
var defaultOptions = {
    passphrase_protection: false,
    pin_protection: true,
    language: null,
    label: null,
    word_count: 12,
    enforce_wordlist: false,
    use_character_cipher: true
};

module.exports = function recoveryDevice(args) {
    client = this;

    var options = _.extend({}, defaultOptions, args);

    return featuresService.getPromise()
        .then(function (features) {
            if (!features.initialized) {
                var message = new client.protoBuf.RecoveryDevice(
                    options.word_count, options.passphrase_protection, options.pin_protection,
                    options.language, options.label, options.enforce_wordlist, options.use_character_cipher
                );
                return client.writeToDevice(message);
            } else {
                return Promise.reject("Expected features.initialized to be false", features);
            }
        })
        .catch(function (failure) {
            logger.error('deviceRecovery failed', arguments);
            return Promise.reject(failure);
        });
};
