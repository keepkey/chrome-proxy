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
var $q = require('q');
var keepKeyWalletId = config.keepkeyWallet.applicationId;
var clientEE = new EventEmitter2();

var isDeviceConnected = function () {
    return $q.Promise(function (resolve, reject, notify) {
        chrome.hid.getDevices({}, function (hidDevices) {
            resolve(!!hidDevices.length);
        });
    });
};

chrome.runtime.onMessageExternal.addListener(
    function (request, sender, sendResponse) {
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
                //case 'reset':
                //    clientPool[0].ready()
                //        .resetDevice({
                //            passphrase_protection: false,
                //            pin_protection: true,
                //            label: "My Label"
                //        })
                //        .then(console.log('device reset'));

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

function createClientForDevice(transport) {
    var client = clientModule.factory(transport);
    clientEE.emit('clientConnected');

    chrome.runtime.sendMessage(
        keepKeyWalletId,
        {
            messageType: "connected",
            deviceType: client.getDeviceType(),
            deviceId: transport.getDeviceId()
        }
    );

    console.log("%s connected: %d", client.getDeviceType(), transport.getDeviceId());
}

chrome.hid.onDeviceAdded.addListener(function (hidDevice) {
    transportHidModule.onConnect(hidDevice, createClientForDevice);
});

/**
 * Listen for HID disconnects, and clean up when one happends
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
