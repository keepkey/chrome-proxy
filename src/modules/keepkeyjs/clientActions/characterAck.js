var featuresService = require('../featuresService.js');
var client;

module.exports = function (args) {
    client = this;

    args.character = args.character || null;
    args.delete = args.delete || null;
    args.done = args.done || null;
    return featuresService.getPromise()
        .then(function (features) {
            var message = new client.protoBuf.CharacterAck(args.character, args.delete, args.done);
            return client.writeToDevice(message);
        });
};