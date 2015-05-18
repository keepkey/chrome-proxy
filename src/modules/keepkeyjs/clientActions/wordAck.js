var featuresService = require('../simpleGlobalStore.js');
var client;

module.exports = function wordAck(args) {
    client = this;
    return featuresService.getPromise()
        .then(function (features) {
            var message = new client.protoBuf.WordAck(args.word);
            return client.writeToDevice(message);
        });
};