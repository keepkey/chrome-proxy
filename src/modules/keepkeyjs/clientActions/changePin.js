var _ = require('lodash');

var client;
var defaultOptions = {
    remove: false
};

module.exports = function changePin(args) {
  client = this;

  var options = _.extend({}, defaultOptions, args);
  var message = new client.protoBuf.ChangePin(
      options.remove
  );

  return client.writeToDevice(message)
    .catch(function(message) {
      if (message.code !== "Failure_ActionCancelled") {
        return Promise.reject(message);
      }
    });
};