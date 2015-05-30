/* globals chrome */
/* jshint devel: true */

/** START KEEPKEY LICENSE
 *
 * This file is part of the KeepKeyJS project.
 *
 * Copyright (C) 2015 KeepKey, LLC.
 *
 * This library is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this library.  If not, see <http://www.gnu.org/licenses/>.
 *
 * END KEEPKEY LICENSE
 */

var EventEmitter2 = require('eventemitter2').EventEmitter2;
var clientModule = require('./modules/keepkeyjs/client.js');
var transportModule = require('./modules/keepkeyjs/transport.js');
var transportHidModule = require('./modules/keepkeyjs/transport_hid.js');
var config = require('../dist/config.json');
var _ = require('lodash');
var dispatcher = require('./messageDispatcher');

var keepKeyWalletId = config.keepkeyWallet.applicationId;
var clientEE = new EventEmitter2();

dispatcher.when('deviceReady', function (client, request, sender, sendResponse) {
    sendResponse({
        messageType: "deviceReadyResponse",
        result: !!client
    });
});

dispatcher.when('reset', function (client, request) {
    return client.resetDevice(request);
});

dispatcher.when('PinMatrixAck', function (client, request) {
    return client.pinMatrixAck(request);
});

dispatcher.when('Initialize', function (client) {
    return client.initialize();
});

dispatcher.when('Wipe', function (client) {
    return client.wipeDevice();
});

dispatcher.when('Cancel', function (client) {
    return client.cancel();
});

dispatcher.when('RecoveryDevice', function (client) {
    return client.recoveryDevice();
});

dispatcher.when('WordAck', function (client, request) {
    return client.wordAck(request);
});

dispatcher.when('CharacterAck', function (client, request) {
    return client.characterAck(request);
});

dispatcher.when('FirmwareUpdate', function (client, request) {
    return client.firmwareUpdate(request);
});

dispatcher.otherwise(function (request, response, sendResponse) {
    sendResponse({
        messageType: "Error",
        result: "Unknown message type: " + request.messageType
    });
});

chrome.runtime.onMessageExternal.addListener(
    function (request, sender, sendResponse) {
        console.log('client message:', request);
        if (sender.id === keepKeyWalletId) {
            dispatcher.dispatch(request, sender, sendResponse);
            return true;
        } else {
            sendResponse({
                messageType: "Error",
                result: "Unknown sender " + sender.id + ", message rejected"
            });
        }
        return false;
    }
);

function sendMessageToUI(type, message) {
    console.log('Sending "%s" message to ui: %o', type, message);
    chrome.runtime.sendMessage(
        keepKeyWalletId,
        {
            messageType: type,
            message: message
        }
    );
}

module.exports = {
    sendMessageToUI: sendMessageToUI
};

function createClientForDevice(deviceTransport) {
    var client = clientModule.factory(deviceTransport);
    client.addListener('DeviceMessage', function onDeviceMessage(type, message) {
        sendMessageToUI(type, message);
    });

    clientEE.emit('clientConnected');

    sendMessageToUI("connected", {
        deviceType: client.getDeviceType(),
        deviceId: deviceTransport.getDeviceId()
    });
}

chrome.hid.onDeviceAdded.addListener(function (hidDevice) {
    transportHidModule.onConnect(hidDevice, createClientForDevice);
});

/**
 * Listen for HID disconnects, and clean up when one happens
 */
chrome.hid.onDeviceRemoved.addListener(function (deviceId) {
    var device = transportModule.find(deviceId);

    var deviceType = clientModule.find(device).getDeviceType();

    clientModule.remove(device);
    transportModule.remove(deviceId);

    clientEE.emit('clientDisconnected');

    chrome.runtime.sendMessage(
        keepKeyWalletId,
        {
            messageType: "disconnected",
            deviceType: deviceType,
            deviceId: deviceId
        }
    );

    console.log("%s Disconnected: %d", deviceType, deviceId);


});

/**
 * Enumerate devices that are already connected
 */
chrome.hid.getDevices({}, function (hidDevices) {
    for (var i = 0, iMax = hidDevices.length; i < iMax; i += 1) {
        transportHidModule.onConnect(hidDevices[i], createClientForDevice);
    }
});




