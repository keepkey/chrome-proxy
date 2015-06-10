var featuresService = require('../featuresService.js');
var _ = require('lodash');

var client;

module.exports = function endSession(args) {
    client = this;

    return featuresService.getPromise()
        .then(function (features) {
            var message = new client.protoBuf.ClearSession();
            return client.writeToDevice(message);
        });
};