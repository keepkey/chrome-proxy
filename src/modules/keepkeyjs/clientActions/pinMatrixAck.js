var featuresService = require('../featuresService.js');
var _ = require('lodash');

var client;
var defaultOptions = {
    pin: ''
};

module.exports = function pinMatrixAck(args) {
    client = this;

    var options = _.extend({}, defaultOptions, args);

    return featuresService.getPromise()
        .then(function (features) {
            var message = new client.protoBuf.PinMatrixAck(options.pin);
            return client.writeToDevice(message);
        });
};