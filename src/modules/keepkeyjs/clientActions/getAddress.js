var featuresService = require('../featuresService.js');
var _ = require('lodash');
var NodePathHelper = require('../NodePathHelper.js');

var client;
var defaultOptions = {
    addressN: [],
    coinName: 'Bitcoin',
    showDisplay: false,
    multisig: null
};

module.exports = function getAddress(args) {
    client = this;

    var options = _.extend({}, defaultOptions, args);

    return featuresService.getPromise()
        .then(function (features) {
            options.addressN = NodePathHelper.toVector(options.addressN);

            var message = new client.protoBuf.GetAddress(
                options.addressN,
                options.coinName,
                options.showDisplay
            );
            return client.writeToDevice(message);
        });
};

