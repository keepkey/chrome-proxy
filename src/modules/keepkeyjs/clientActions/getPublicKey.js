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

function readNodePath(addressN) {
    if (typeof addressN === "string") {
        addressN = addressN.toUpperCase().split('/');

        if (addressN[0] === 'M') {
            addressN = addressN.slice(1);
        }
        addressN = _.transform(addressN, function (result, it) {
            if (it.substring(it.length - 1) === "'") {
                it = '-' + it.substring(0, it.length - 1);
            }

            if (it === '-0') {
                result.push(PRIME_DERIVATION_FLAG);
            } else {
                result.push(parseInt(it, 10));
            }
        }, []);
    }
    return convertPrime(addressN);
}


module.exports = function getPublicKey(args) {
    client = this;

    var options = _.extend({}, defaultOptions, args);

    return featuresService.getPromise()
        .then(function (features) {
            options.addressN = readNodePath(options.addressN);

            console.log('Normalized node path:', options.addressN);

            var message = new client.protoBuf.GetPublicKey(
                options.addressN
            );
            return client.writeToDevice(message);
        });
};

