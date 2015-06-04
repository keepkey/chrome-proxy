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

const SEGMENT_SIZE = 63;
const REPORT_ID = 63;

var ByteBuffer = require('bytebuffer');
var transport = require('./transport.js');
var HID = require('node-hid');

module.exports.onConnect = function (deviceInfo, callback) {
    var hidDevice = new HID.HID(deviceInfo.vendorId, deviceInfo.productId);
    var hidDeviceId = 1;
    var that = transport.create(hidDeviceId);

    var connect = function (callback) {
        callback(that);
    };

    that._write = function (message) {
        // break frame into segments
        for (var i = 0, max = message.limit; i < max; i += SEGMENT_SIZE) {
            var segment = ByteBuffer.concat([
                ByteBuffer.wrap([REPORT_ID]),
                message.slice(i, Math.min(i + SEGMENT_SIZE, message.limit))
            ]);
            hidDevice.write(segment.toBuffer());
        }

        return Promise.resolve();
    };

    that._read = function () {
        if (that.readInProgess) {
            return Promise.reject('read is not re-entrant');
        }
        that.readInProgess = true;
        return new Promise(function (resolve, reject) {
            hidDevice.read(function (error, data) {
                const PAYLOAD_START = transport.MSG_HEADER_START.length + transport.MSG_HEADER_LENGTH + 1;

                if (error) {
                    that.readInProgess = false;
                    reject(error);
                    return;
                }

                var reportId = ByteBuffer.wrap(data).slice(0, 1).toUTF8().charCodeAt(0);
                if (reportId !== REPORT_ID) {
                    that.readInProgess = false;
                    reject('unknown report ID');
                    return;
                }

                var timeout = setTimeout(function () {
                    console.log("timed out");
                    that.readInProgess = false;
                    reject('Message not received');
                }, 1000);

                var bbData = ByteBuffer.wrap(data).slice(1);

                var receivedMessage = {};
                receivedMessage.header = transport.parseMsgHeader(ByteBuffer.wrap(bbData));
                receivedMessage.bufferBB = new ByteBuffer(receivedMessage.header.msgLength);

                receivedMessage.bufferBB.append(bbData.slice(PAYLOAD_START));

                var bytesRemaining = receivedMessage.bufferBB.limit - receivedMessage.bufferBB.offset;

                if (bytesRemaining > 0) {
                    var remainingFragments = Math.ceil(bytesRemaining / SEGMENT_SIZE);
                    var processNextFragment = function processNextFragment(error, data) {
                        var bbData = ByteBuffer.wrap(data);
                        receivedMessage.bufferBB.append(
                            bbData.slice(1, Math.min(bbData.limit, receivedMessage.bufferBB.limit - receivedMessage.bufferBB.offset))
                        );
                        if (receivedMessage.bufferBB.offset >= (receivedMessage.bufferBB.limit - 1)) {
                            clearTimeout(timeout);
                            receivedMessage.bufferBB.reset();
                            that.readInProgess = false;
                            resolve(receivedMessage);
                        }
                    };

                    for (var i = 0; i < remainingFragments; i++) {
                        hidDevice.read(processNextFragment);
                    }
                } else {
                    clearTimeout(timeout);
                    receivedMessage.bufferBB.reset();
                    that.readInProgess = false;
                    resolve(receivedMessage);
                }


            });
        });
    };

    that.getDeviceInfo = function () {
        return deviceInfo;
    };

    connect(callback);
};
