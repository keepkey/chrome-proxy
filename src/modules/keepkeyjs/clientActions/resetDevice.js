var featuresService = require('../simpleGlobalStore.js');
var client;

module.exports = function resetDevice(args) {
    client = this;

    args = args || {};
    args.display_random = args.display_random || null;
    args.strength = args.strength || null;
    args.passphrase_protection = args.passphrase_protection || null;
    args.pin_protection = args.pin_protection || null;
    args.language = args.language || null;
    args.label = args.label || null;

    return featuresService.getPromise()
        .then(function (features) {
            if (!features.initialized) {
                var message = new client.protoBuf.ResetDevice(
                    args.display_random, args.strength, args.passphrase_protection,
                    args.pin_protection, args.language, args.label
                );
                return client.writeToDevice(message);
            } else {
                return Promise.reject("Expected features.initialized to be false", features);
            }
        })
        .catch(function () {
            console.error('failure initializing the device:', arguments);
        });
};