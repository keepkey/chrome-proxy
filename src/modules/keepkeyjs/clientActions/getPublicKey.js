var featuresService = require('../featuresService.js');
var _ = require('lodash');
var NodePathHelper = require('../NodePathHelper.js');

var client;
var defaultOptions = {
    addressN: [0]
};

module.exports = function getPublicKey(args) {
    client = this;

    var options = _.extend({}, defaultOptions, args);

    return featuresService.getPromise()
        .then(function (features) {
            options.addressN = NodePathHelper.toVector(options.addressN);

            console.log('Normalized node path:', options.addressN);

            var message = new client.protoBuf.GetPublicKey(
                options.addressN
            );
            return client.writeToDevice(message);
        });
};

