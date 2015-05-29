var featuresService = require('../featuresService.js');
var _ = require('lodash');

var client;
var defaultOptions = {
    character: '',
    delete: false,
    done: false
};

module.exports = function characterAck(args) {
    client = this;

    var options = _.extend({}, defaultOptions, args);

    return featuresService.getPromise()
        .then(function (features) {
            var message = new client.protoBuf.CharacterAck(options.character, options.delete, options.done);
            return client.writeToDevice(message);
        });
};