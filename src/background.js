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
var extend = require('extend-object');
var keepKeyWalletId = config.keepkeyWallet.applicationId;
var clientEE = new EventEmitter2();

var isDeviceConnected = function () {
    return new Promise(function (resolve, reject, notify) {
        chrome.hid.getDevices({}, function (hidDevices) {
            resolve(!!hidDevices.length);
        });
    });
};

chrome.runtime.onMessageExternal.addListener(
    function (request, sender, sendResponse) {
        console.log('client message:', request);
        if (sender.id === keepKeyWalletId) {
            switch (request.messageType) {
                case 'deviceReady':
                    isDeviceConnected().then(function (isConnected) {
                        sendResponse({
                            messageType: "deviceReadyResponse",
                            result: isConnected
                        });
                    });
                    return true;
                case 'reset':
                    var args = extend({
                        passphrase_protection: false,
                        pin_protection: true,
                        label: "My KeepKey Device"
                    }, request);
                    delete args.messageType;

                    new Promise(function (resolve, reject, notify) {
                        chrome.hid.getDevices({}, function (hidDevices) {
                            // TODO This needs to be smarter about selecting a device to reset
                            resolve(hidDevices[0].deviceId);
                        });
                    }).then(function (deviceId) {
                            var client = clientModule.findByDeviceId(deviceId);
                            return client.resetDevice(args);
                        });

                    return true;

                case 'PinMatrixAck':
                    var renameThisArgs = extend({}, request);

                    new Promise(function (resolve) {
                        chrome.hid.getDevices({}, function (hidDevices) {
                            // TODO This needs to be smarter about selecting a device to reset
                            resolve(hidDevices[0].deviceId);
                        });
                    }).then(function (deviceId) {
                            var client = clientModule.findByDeviceId(deviceId);
                            return client.pinMatrixAck(renameThisArgs);
                        });

                    return true;
                case 'Initialize':
                    new Promise(function (resolve) {
                        chrome.hid.getDevices({}, function (hidDevices) {
                            // TODO This needs to be smarter about selecting a device to reset
                            resolve(hidDevices[0].deviceId);
                        });
                    }).then(function (deviceId) {
                            var client = clientModule.findByDeviceId(deviceId);
                            return client.initialize();
                        });

                    return true;
                case 'Wipe':
                    new Promise(function (resolve) {
                        chrome.hid.getDevices({}, function (hidDevices) {
                            // TODO This needs to be smarter about selecting a device to reset
                            resolve(hidDevices[0].deviceId);
                        });
                    }).then(function (deviceId) {
                            var client = clientModule.findByDeviceId(deviceId);
                            return client.wipeDevice();
                        });

                    return true;

                case 'Cancel':
                    new Promise(function (resolve) {
                        chrome.hid.getDevices({}, function (hidDevices) {
                            // TODO This needs to be smarter about selecting a device to reset
                            resolve(hidDevices[0].deviceId);
                        });
                    }).then(function (deviceId) {
                            var client = clientModule.findByDeviceId(deviceId);
                            return client.cancel();
                        });

                    return true;

                case 'RecoveryDevice':
                    new Promise(function (resolve) {
                        chrome.hid.getDevices({}, function (hidDevices) {
                            // TODO This needs to be smarter about selecting a device to reset
                            resolve(hidDevices[0].deviceId);
                        });
                    }).then(function (deviceId) {
                            var client = clientModule.findByDeviceId(deviceId);
                            return client.recoveryDevice();
                        });

                    return true;

                case 'WordAck':
                    new Promise(function (resolve) {
                        chrome.hid.getDevices({}, function (hidDevices) {
                            // TODO This needs to be smarter about selecting a device to reset
                            resolve(hidDevices[0].deviceId);
                        });
                    }).then(function (deviceId) {
                            var client = clientModule.findByDeviceId(deviceId);
                            return client.wordAck(extend({}, request));
                        });

                    return true;

                case 'CharacterAck':
                    new Promise(function (resolve) {
                        chrome.hid.getDevices({}, function (hidDevices) {
                            // TODO This needs to be smarter about selecting a device to reset
                            resolve(hidDevices[0].deviceId);
                        });
                    }).then(function (deviceId) {
                            var client = clientModule.findByDeviceId(deviceId);
                            return client.characterAck(extend({}, request));
                        });

                    return true;

                default:
                    sendResponse({
                        messageType: "Error",
                        result: "Unknown message type: " + request.messageType
                    });
            }
        } else {
            sendResponse({
                messageType: "Error",
                result: "Unknown sender " + sender.id + ", message rejected"
            });
        }
        return false;
    }
);


function createClientForDevice(deviceTransport) {
    var client = clientModule.factory(deviceTransport);
    client.addListener('DeviceMessage', function onDeviceMessage(type, message) {
        console.log('Sending %s message to ui: %o', type, message);

        chrome.runtime.sendMessage(
            keepKeyWalletId,
            {
                messageType: type,
                message: message
            }
        );
    });
    clientEE.emit('clientConnected');

    chrome.runtime.sendMessage(
        keepKeyWalletId,
        {
            messageType: "connected",
            deviceType: client.getDeviceType(),
            deviceId: deviceTransport.getDeviceId()
        }
    );

    console.log("%s connected: %d", client.getDeviceType(), deviceTransport.getDeviceId());
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




