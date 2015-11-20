var _ = require('lodash');

var hydrate = require('./hydrate.js');
var messageStates = require('./services/messageStates.js');
var logger = require('../../logger.js');
var buffer2Hex = require('./buffer2Hex.js');
var config = require('../../../dist/config.json');

function StatefulDeviceMessenger(transport) {
  this.writeRequestInProgress = [];
  this.transport = transport;
}

StatefulDeviceMessenger.prototype.send = function send(message) {
  //TODO Don't send messages when the device is in the wrong mode
  var self = this;

  var messageType = message.$type.name;
  var states = messageStates.getHostMessageStates(messageType);

  if (self.writeRequestInProgress.length) {
    var lastRequest = _.last(self.writeRequestInProgress);
    if (lastRequest.resolveMessage === messageType) {
      self.writeRequestInProgress.pop();
    } else if (messageType === "Cancel") {
      if (lastRequest.sender === "device") {
        self.writeRequestInProgress.pop();
      }
    } else if (_.indexOf(lastRequest.interstitialMessages, messageType) === -1) {
      return Promise.reject(
        'Unexpected message write request: [' + messageType + ']' +
        JSON.stringify(hydrate(message), buffer2Hex, 2)
      );
    }
  }

  return new Promise(function (resolve, reject) {
    if (states && states.resolveMessage) {
      self.writeRequestInProgress.push(_.extend({
        resolve: resolve,
        reject: reject
      }, states));
    }

    logger.info('proxy --> device:\n    [%s] %s\n    WaitFor: %s',
      message.$type.name,
      JSON.stringify(hydrate(message), buffer2Hex, config.jsonIndent),
      states && states.resolveMessage);

    self.transport.write.call(self.transport, message)
      .catch(function () {
        logger.debug('Failed when writing to device');
        self.writeRequestInProgress.length = 0;
        reject.apply(message);
      });
  });
};

StatefulDeviceMessenger.prototype.receive = function receive(message) {
  var self = this;

  var messageType = message.$type.name;
  var hydratedMessage = hydrate(message);

  if (self.writeRequestInProgress.length) {
    var writeRequest = _.last(self.writeRequestInProgress);

    if (messageType === "TxRequest") {
      messageType += '_' + hydratedMessage.request_type;
    }

    if (writeRequest.resolveMessage === messageType) {
      self.writeRequestInProgress.pop();
      writeRequest.resolve(hydratedMessage);
    } else if (writeRequest.interstitialMessages &&
      _.indexOf(writeRequest.interstitialMessages, messageType) !== -1) {

      self.writeRequestInProgress.push(
        messageStates.getDeviceMessageStates(message.$type.name));
      return;
    } else if (writeRequest.rejectMessage === messageType) {
      self.writeRequestInProgress.pop();
      writeRequest.reject(hydratedMessage);
    } else {
      self.writeRequestInProgress.length = 0;
      writeRequest.reject(hydratedMessage);
    }
  } else {
    console.error('no incoming messages expected. got:', messageType);
  }
};

module.exports = StatefulDeviceMessenger;
