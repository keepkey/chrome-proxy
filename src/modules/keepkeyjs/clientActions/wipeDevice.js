var client;

module.exports = function wipeDevice() {
    client = this;
    return client.writeToDevice(new client.protoBuf.WipeDevice());
};