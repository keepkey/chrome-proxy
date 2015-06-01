/* globals chrome */
var clientModule = require('./modules/keepkeyjs/client.js');

function getActiveDeviceId() {
    return new Promise(function (resolve, reject, notify) {
        chrome.hid.getDevices({}, function (hidDevices) {
            // TODO This needs to be smarter about selecting a device
            resolve(hidDevices.length ? hidDevices[0].deviceId : null);
        });
    });
}


function getActiveClient() {
    return getActiveDeviceId()
        .then(function (deviceId) {
            return deviceId ? clientModule.findByDeviceId(deviceId) : null;
        });
}

var messageDispatchers = {};
var defaultAction;

module.exports = {
    when: function registerMessageDispatcher(messageType, action) {
        messageDispatchers[messageType] = action;
    },
    otherwise: function registerDefaultAction(action) {
        defaultAction = action;
    },
    dispatch: function dispatchMessage(request, sender, sendResponse) {
        var action = messageDispatchers[request.messageType];

        if (action) {
            getActiveClient()
                .then(function (client) {
                    action(client, request, sender, sendResponse);
                }, function () {
                    throw 'error exectuting action';
                });
        } else if (defaultAction) {
            defaultAction(request, sender, sendResponse);
        }
    }

};