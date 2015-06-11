var featuresService = require('../featuresService.js');
var client;

module.exports = function cancel(args) {
    client = this;

    return featuresService.getPromise()
        .then(function (features) {
            var message = new client.protoBuf.Cancel();
            return client.writeToDevice(message);
        });
};

