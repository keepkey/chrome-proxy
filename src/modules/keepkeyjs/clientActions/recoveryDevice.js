var featuresService = require('../simpleGlobalStore.js');
var client;

module.exports = function recoveryDevice(args) {
    client = this;

    args = args || {};

    args.passphrase_protection = args.passphrase_protection || false;
    args.pin_protection = args.pin_protection || true;
    args.language = args.language || null;
    args.label = args.label || null;
    args.word_count = args.word_count || 12;
    args.enforce_wordlist = args.enforce_wordlist || false;
    args.use_character_cipher = args.use_character_cipher || true;

    return featuresService.getPromise()
        .then(function (features) {
            if (!features.initialized) {
                var message = new client.protoBuf.RecoveryDevice(
                    args.word_count, args.passphrase_protection, args.pin_protection,
                    args.language, args.label, args.enforce_wordlist, args.use_character_cipher
                );
                return client.writeToDevice(message);
            } else {
                return Promise.reject("Expected features.initialized to be false", features);
            }
        })
        .catch(function () {
            console.error('deviceRecovery failed', arguments);
        });
};
