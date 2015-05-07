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

(function () {

    'use strict';

    var jspack = require('jspack').jspack,
        ByteBuffer = require('bytebuffer');

    module.exports.MSG_HEADER_START = '##';
    module.exports.MSG_HEADER_LENGTH = jspack.CalcLength('>HL');

    module.exports.DEVICES = {
        KEEPKEY: {vendorId: 11044, productId: 1},
        TREZOR: {vendorId: 21324, productId: 1}
    };

    var transports = {},
        messageMaps = {};

    module.exports.create = (function () {

        function transportMaker(deviceId) {

            var that = {},          // new transport object
                messageMap = null,    // message map that facilitates msg type and class lookup
                protoBuf = null;      // protocol buffers for transport

            function parseMsg(msgType, msgBB) {
                var msgClass = that.getMsgClass(msgType);
                return protoBuf[msgClass].decode(msgBB);
            }

            that.setMessageMap = function (deviceType, proto) {
                var msgClass = '', currentMsgClass = '';

                if (!messageMaps.hasOwnProperty(deviceType)) {
                    messageMaps[deviceType] = {
                        msgTypeToClass: {},
                        msgClassToType: {}
                    };

                    // cache message maps
                    for (msgClass in proto.MessageType) {
                        if (proto.MessageType.hasOwnProperty(msgClass)) {
                            currentMsgClass = msgClass.replace('MessageType_', '');
                            messageMaps[deviceType].msgClassToType[currentMsgClass] = proto.MessageType[msgClass];
                            messageMaps[deviceType].msgTypeToClass[proto.MessageType[msgClass]] = currentMsgClass;
                        }
                    }
                }

                messageMap = messageMaps[deviceType];
                protoBuf = proto;
            };

            that.getMsgType = function (msgClass) {
                if (!messageMap.msgClassToType.hasOwnProperty(msgClass)) {
                    throw {
                        name: 'Error',
                        message: 'Cannot find message name.'
                    };
                } else {
                    return messageMap.msgClassToType[msgClass];
                }
            };

            that.getMsgClass = function (msgType) {
                if (!messageMap.msgTypeToClass.hasOwnProperty(msgType)) {
                    throw {
                        name: 'Error',
                        message: 'Cannot find message id.'
                    };
                } else {
                    return messageMap.msgTypeToClass[msgType];
                }
            };

            that.getDeviceId = function () {
                return deviceId;
            };

            that.getDeviceInfo = function () {
                return {};
            };

            that.write = function (txProtoMsg) {
                var msgAB = txProtoMsg.encodeAB(),
                    msgBB = ByteBuffer.concat([
                            ByteBuffer.wrap('##'),                                                                        // message start
                            new Uint8Array(jspack.Pack('>HL', [that.getMsgType(txProtoMsg.$type.name), msgAB.byteLength])), // header
                            msgAB]                                                                                        // message
                    );

                return that._write(msgBB);
            };

            that.read = function () {
                return that._read()
                    .then(function (rxMsg) {
                        return parseMsg(rxMsg.header.msgType, ByteBuffer.wrap(rxMsg.bufferBB.toArrayBuffer().slice(0, rxMsg.header.msgLength)));
                    });
            };

            that._write = function () {
                console.error("Error: The protected _write() function is not implemented");
                throw {
                    name: 'Error',
                    message: '_write not implemented.'
                };
            };

            that._read = function () {
                console.error("Error: The protected _read() function is not implemented");
                throw {
                    name: 'Error',
                    message: '_read not implemented.'
                };
            };

            return that;

        }

        return function (deviceId) {

            if (!transports.hasOwnProperty(deviceId)) {
                transports[deviceId] = transportMaker(deviceId);
            }

            return transports[deviceId];
        };
    })();

    module.exports.parseMsgHeader = function (msgBB) {
        var msgHeader;

        // check for header message start
        for (var i = 0,
                 iMax = module.exports.MSG_HEADER_START.length; i < iMax; i += 1) {
            var next = String.fromCharCode(msgBB.readByte());

            if (next !== module.exports.MSG_HEADER_START[i]) {
                throw {
                    name: 'Error',
                    message: 'Message header not found when it was expected.'
                };
            }
        }

        // unpack header
        msgHeader = jspack.Unpack('>HL', new Uint8Array(msgBB.toArrayBuffer().slice(0, module.exports.MSG_HEADER_LENGTH)));

        // reset msg bytebuffer
        msgBB.reset();

        return {
            msgType: msgHeader.shift(),
            msgLength: msgHeader.shift()
        };
    };

    module.exports.hasDeviceId = function (deviceId) {
        return transports.hasOwnProperty(deviceId);
    };

    module.exports.getDeviceIds = function () {
        return Object.keys(transports);
    };

    module.exports.find = function (deviceId) {
        return transports[deviceId];
    };

    module.exports.remove = function (deviceId) {
        delete transports[deviceId];
    };

})();