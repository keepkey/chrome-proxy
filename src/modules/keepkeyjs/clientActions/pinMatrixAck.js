var featuresService = require('../featuresService.js');
var client;

module.exports = function pinMatrixAck(args) {
    client = this;

    return featuresService.getPromise()
        .then(function (features) {
            if (!features.initialized) {
                var message = new client.protoBuf.PinMatrixAck(args.pin);
                return client.writeToDevice(message);
            } else {
                return Promise.reject("Error: Expected features.initialized to be false: ", features);
            }

        })
        .catch(function () {
            console.error('failure', arguments);
        });
};