var _ = require('lodash');

var client;
var defaultOptions = {
  use_passphrase: null,
  language: null,
  label: null
};

module.exports = function applySettings(args) {
  client = this;

  var options = _.extend({}, defaultOptions, args);
  var message = new client.protoBuf.ApplySettings(
    options.language, options.label, options.use_passphrase
  );

  return client.writeToDevice(message)
    .catch(function (message) {
      if (message.code !== 'Failure_ActionCancelled') {
        return Promise.reject(message);
      }
    });
};