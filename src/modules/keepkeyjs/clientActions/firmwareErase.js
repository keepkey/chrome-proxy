var featuresService = require('../simpleGlobalStore.js');
var client;

module.exports = function eraseFirmware(args) {
    client = this;
    return featuresService.getPromise()
        .then(function (features) {
            return new Promise(function(resolve, reject) {
                if (features.bootloader_mode) {
                    var message = new client.protoBuf.FirmwareErase();
                    resolve(client.writeToDevice(message));
                }
                else {
                    reject('Device must be in bootloader mode');
                }
            });
        });
};