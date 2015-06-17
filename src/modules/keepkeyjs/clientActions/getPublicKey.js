var featuresService = require('../featuresService.js');
var _ = require('lodash');
var uint32 = require('uint32');

var client;
var defaultOptions = {
    addressN: [0]
};

const PRIME_DERIVATION_FLAG = 0x80000000;

function convertPrime(n) {
    var i = 0, max = n.length;

    for (; i < max; i += 1) {
        if (n[i] < 0) {
            n[i] = uint32.or(Math.abs(n[i]), PRIME_DERIVATION_FLAG);
        }
    }

    return n;
}

module.exports = function getPublicKey(args) {
    client = this;

    var options = _.extend({}, defaultOptions, args);

    return featuresService.getPromise()
        .then(function (features) {
            options.addressN = convertPrime(options.addressN, 10);

            var message = new client.protoBuf.GetPublicKey(
                options.addressN
            );
            return client.writeToDevice(message);
        });
};

