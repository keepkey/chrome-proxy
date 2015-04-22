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

;(function() {

	'use strict';

  /////////////
  // REQUIRE //
  /////////////

  var jspack = require('jspack').jspack,
    ByteBuffer = require('bytebuffer');

  ///////////////
  // CONSTANTS //
  ///////////////

  module.exports.MSG_HEADER_START = '##';
  module.exports.MSG_HEADER_LENGTH = jspack.CalcLength('>HL');

  module.exports.DEVICES = {
    KEEPKEY: {vendorId: 11044, productId: 1},
    TREZOR: {vendorId: 21324, productId: 1}
  };

  //////////////////////////////
  // PRIVATE STATIC VARIABLES //
  //////////////////////////////

  var transports = {},
    messageMaps = {};

  ///////////////////////////
  // PUBLIC STATIC METHODS //
  ///////////////////////////

  /**
   * Creates a new transport object, making sure there only ever exists one
   * transport per device id
   * @return {Transport}
   */
	module.exports.create = (function() {

		function transportMaker(deviceId) {

      ///////////////////////
      // PRIVATE VARIABLES //
      ///////////////////////

      var that = {},          // new transport object
        messageMap = null,    // message map that facilitates msg type and class lookup
        protoBuf = null;      // protocol buffers for transport

      /////////////////////
      // PRIVATE METHODS //
      /////////////////////

      /**
       * Parses a given ByteBuffer into a protocol buffer object
       * @param  {Integer}    msgType   message type to parse into
       * @param  {ByteBuffer} msgBB     message to parse
       * @return {ProtoBuf}
       */
      function parseMsg(msgType, msgBB) {
        var msgClass = that.getMsgClass(msgType);
        return protoBuf[msgClass].decode(msgBB);
      }

      ////////////////////
      // PUBLIC METHODS //
      ////////////////////

      /**
       * Builds a message map for transport to translate
       * message ids to names and message names to ids
       * @param {String}    deviceType  type of device, for example 'KEEPKEY'
       * @param {ProtoPuf}  proto       protocol buffers to be used for map
       */
      that.setMessageMap = function(deviceType, proto) {
        var msgClass = '', currentMsgClass = '';

        if(!messageMaps.hasOwnProperty(deviceType)) {
          messageMaps[deviceType] = {
            msgTypeToClass: {},
            msgClassToType: {}
          };

          // cache message maps
          for(msgClass in proto.MessageType) {
            if(proto.MessageType.hasOwnProperty(msgClass)) {
              currentMsgClass = msgClass.replace('MessageType_', '');
              messageMaps[deviceType].msgClassToType[currentMsgClass] = proto.MessageType[msgClass];
              messageMaps[deviceType].msgTypeToClass[proto.MessageType[msgClass]] = currentMsgClass;
            }
          }
        }

        messageMap = messageMaps[deviceType];
        protoBuf = proto;
      };

      /**
       * Gets message type by message class
       * @param  {String}   msgClass  class name to lookup
       * @return {Integer}
       */
      that.getMsgType = function(msgClass) {
        if(!messageMap.msgClassToType.hasOwnProperty(msgClass)) {
          throw {
            name: 'Error',
            message: 'Cannot find message name.'
          };
        } else {
          return messageMap.msgClassToType[msgClass];
        }
      };

      /**
       * Gets message class by message type
       * @param  {Integer}  msgType   message type to lookup
       * @return {String}
       */
      that.getMsgClass = function(msgType) {
        if(!messageMap.msgTypeToClass.hasOwnProperty(msgType)) {
          throw {
            name: 'Error',
            message: 'Cannot find message id.'
          };
        } else {
          return messageMap.msgTypeToClass[msgType];
        }
      };

      /**
       * Returns device id for transport
       * @return {Integer}
       */
			that.getDeviceId = function() {
				return deviceId;
			};

      /**
       * Returns vendor id and product id of device
       * (implemented in children)
       * @return {Object}
       */
      that.getDeviceInfo = function() {
        return {};
      };

      /**
       * Writes a message to transport
       * @param  {ProtoBuf} txProtoMsg  Protocol buffer bessage to write ro transport
       * @return {Promise}
       */
      that.write = function(txProtoMsg) {
        var msgAB = txProtoMsg.encodeAB(),
          msgBB = ByteBuffer.concat([
            ByteBuffer.wrap('##'),                                                                        // message start
            new Uint8Array(jspack.Pack('>HL', [that.getMsgType(txProtoMsg.$type.name), msgAB.byteLength])), // header
            msgAB]                                                                                        // message
          );

        return that._write(msgBB);
      };

      /**
       * Read data from transport while there is data to be read.
       * @return {Promise}
       */
      that.read = function() {
        return that._read()
          .then(function(rxMsg) {
            return parseMsg(rxMsg.header.msgType, ByteBuffer.wrap(rxMsg.bufferBB.toArrayBuffer().slice(0, rxMsg.header.msgLength)));
          });
      };

      ///////////////////////
      // PROTECTED METHODS //
      ///////////////////////

      /**
       * Raw write (implemented in children)
       * @return {Promise}
       */
      that._write = function() {
        throw {
          name: 'Error',
          message: '_write not implemented.'
        };
      };

      /**
       * Raw read (implemented in children)
       * @return {Promise}
       */
      that._read = function() {
        throw {
          name: 'Error',
          message: '_read not implemented.'
        };
      };

      // return newly created transport object
			return that;

		}

    /**
     * Only ever create one instance of a transport
     * for a given device id.
     * @param  {Integer}  deviceId  device id for transport
     * @return {Transport}
     */
		return function(deviceId) {

			if(!transports.hasOwnProperty(deviceId)) {
				transports[deviceId] = transportMaker(deviceId);
			}

			return transports[deviceId];
		};
	})();

  /**
   * Parses header information out of a message
   * @param  {ByteBuffer} msgBB   message for header to be parsed from
   * @return {Object}
   */
  module.exports.parseMsgHeader = function(msgBB) {
    var i = 0,
      max = module.exports.MSG_HEADER_START.length,
      msgHeader;

    // check for header message start
    for(; i < max; i += 1) {
      if(String.fromCharCode(msgBB.readByte()) !== module.exports.MSG_HEADER_START[i]) {
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

  /**
   * Determines if a transport already exists for a device id
   * @param  {Integer}  deviceId  device id to look for
   * @return {Boolean}
   */
  module.exports.hasDeviceId = function(deviceId) {
    return transports.hasOwnProperty(deviceId);
  };

  /**
   * Get all the devices ids that there exists transports for
   * @return {Array}
   */
  module.exports.getDeviceIds = function() {
    return Object.keys(transports);
  };

  /**
   * Find a transport by device id
   * @param  {Integer}  deviceId  device id to look for
   * @return {Transport}
   */
  module.exports.find = function(deviceId) {
    return transports[deviceId];
  };

  /**
   * Removes a transport by device id
   * @param  {Integer}  deviceId  device id to look for
   */
  module.exports.remove = function(deviceId) {
    delete transports[deviceId];
  };

})();