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
var transport = require('./../transport.js');
var HID = require('node-hid');
var logger = require('./../../../logger.js');

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
            var payloadFragment = message.slice(i, Math.min(i + SEGMENT_SIZE, message.limit));
            var paddingSize = SEGMENT_SIZE - (payloadFragment.limit - payloadFragment.offset);

            var frame = ByteBuffer.concat([
                ByteBuffer.wrap([REPORT_ID]),
                payloadFragment,
                ByteBuffer.wrap(new Array(paddingSize + 1).join('\0'))
            ]);
            hidDevice.write(frame.toBuffer());
        }
        return Promise.resolve();
    };

    const PAYLOAD_START = transport.MSG_HEADER_START.length + transport.MSG_HEADER_LENGTH + 1;

    function getMessageFragment(receivedMessage) {
        return new Promise(function (resolve) {
            hidDevice.read(function processNextFragment(error, data) {
                logger.debug('>>> got data from HID:', ByteBuffer.wrap(data).toHex());
                var bbData = ByteBuffer.wrap(data);
                receivedMessage.bufferBB.append(
                    bbData.slice(1, Math.min(bbData.limit, receivedMessage.bufferBB.limit - receivedMessage.bufferBB.offset))
                );
                resolve(receivedMessage);
            });
        });
    }

    function ReceivedMessage(bbData) {
        this.header = transport.parseMsgHeader(ByteBuffer.wrap(bbData));
        this.bufferBB = new ByteBuffer(this.header.msgLength)
            .append(bbData.slice(PAYLOAD_START));
        this.bytesRemaining = this.bufferBB.limit - this.bufferBB.offset;
    }

    function getRemainingFragments(receivedMessage) {
        var remainingFragments = Math.ceil(receivedMessage.bytesRemaining / SEGMENT_SIZE);

        var fragmentChain = Promise.resolve(receivedMessage);
        for (var i = 0; i < remainingFragments; i++) {
            fragmentChain = fragmentChain.then(getMessageFragment);
        }
        return fragmentChain;
    }

    that._read = function () {
        if (that.readInProgess) {
            return Promise.reject('read is not re-entrant');
        }
        that.readInProgess = true;
        return new Promise(function (resolve, reject) {
            hidDevice.read(function (error, data) {
                logger.debug('got data from HID:', ByteBuffer.wrap(data).toHex());

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

                var receivedMessage = new ReceivedMessage(ByteBuffer.wrap(data).slice(1), PAYLOAD_START);

                if (receivedMessage.bytesRemaining > 0) {
                    getRemainingFragments(receivedMessage)
                        .then(function (receivedMessage) {
                            clearTimeout(timeout);
                            receivedMessage.bufferBB.reset();
                            that.readInProgess = false;
                            resolve(receivedMessage);
                        });
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
