var _ = require('lodash');

var messageStates = require('../../../../config/message-states.json');

var getMessageStates = function(name, sender, direction) {
  var result = _.find(messageStates, {
    messageName: name,
    sender: sender,
    messageType: direction
  });
  return result;
};



module.exports = {
  getHostMessageStates: _.curryRight(getMessageStates)("host", "request"),
  getDeviceMessageStates: _.curryRight(getMessageStates)("device", "request")
};
