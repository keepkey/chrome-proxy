var client;

module.exports = function changePin() {
  client = this;

  return client.writeToDevice(new client.protoBuf.ChangePin());
};