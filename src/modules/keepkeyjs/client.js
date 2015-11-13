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
var ByteBuffer = require('bytebuffer');
var EventEmitter2 = require('eventemitter2').EventEmitter2;
var hydrate = require('./hydrate.js');
var featuresService = require('./featuresService.js');
var Long = require('long');
var walletNodeService = require('./services/walletNodeService.js');
var config = require('../../../dist/config.json');

var _ = require('lodash');

const KEEPKEY = 'KEEPKEY';
var DEVICES = require('./transport.js').DEVICES;
var logger = require('../../logger.js');

module.exports.KEEPKEY = KEEPKEY;

var clients = {},    // client pool
  clientTypes = {};  // client types used for client creation by type

clientTypes[KEEPKEY] = require('./keepkey/client.js');

function buffer2Hex(k, v) {
  if (v && v.buffer) {
    // NOTE: v.buffer is type Buffer in node and ArrayBuffer in chrome
    if (v.buffer instanceof Buffer) {
      return v.toHex();
    }

    var hexstring = '';
    for (var i = v.offset; i < v.limit; i++) {
      if (v.view[i] < 16) {
        hexstring += 0;
      }
      hexstring += v.view[i].toString(16);
    }
    return hexstring;
  } else if (v && !_.isUndefined(v.low) && !_.isUndefined(v.high) && !_.isUndefined(v.unsigned)) {
    return (new Long(v.low, v.high, v.unsigned)).toString();
  }
  return v;
}

function clientMaker(transport, protoBuf) {
  logger.debug('Initializing client');

  var client = {};
  var deviceInUse = false;

  client.eventEmitter = new EventEmitter2();
  client.addListener = client.eventEmitter.addListener.bind(client.eventEmitter);
  client.writeToDevice = function (message) {
    logger.info('proxy --> device: [%s]\n', message.$type.name, JSON.stringify(message, buffer2Hex, config.jsonIndent));
    return transport.write.apply(transport, arguments);
  };

  client.protoBuf = protoBuf;

  client.readFirmwareFile = require('./chrome/chromeReadFirmwareFile.js');
  client.crypto = require('./chrome/chromeCrypto.js');

  client.initialize = function () {
    return client.writeToDevice(new client.protoBuf.Initialize());
  };
  client.cancel = require('./clientActions/cancel.js').bind(client);
  client.wipeDevice = require('./clientActions/wipeDevice.js').bind(client);
  client.resetDevice = require('./clientActions/resetDevice.js').bind(client);
  client.recoveryDevice = require('./clientActions/recoveryDevice.js').bind(client);
  client.pinMatrixAck = require('./clientActions/pinMatrixAck.js').bind(client);
  client.wordAck = require('./clientActions/wordAck.js').bind(client);
  client.characterAck = require('./clientActions/characterAck.js').bind(client);
  client.firmwareUpdate = require('./clientActions/firmwareErase.js').bind(client);
  client.firmwareUpload = require('./clientActions/firmwareUpload.js').bind(client);
  client.getAddress = require('./clientActions/getAddress.js').bind(client);
  client.getPublicKey = require('./clientActions/getPublicKey.js').bind(client);
  client.signMessage = require('./clientActions/signMessage.js').bind(client);
  client.encryptMessage = require('./clientActions/encryptMessage.js').bind(client);
  client.encryptKeyValue = require('./clientActions/encryptKeyValue.js').bind(client);
  client.decryptKeyValue = require('./clientActions/decryptKeyValue.js').bind(client);
  client.endSession = require('./clientActions/endSession.js').bind(client);
  client.changePin = require('./clientActions/changePin.js').bind(client);
  client.applySettings = require('./clientActions/applySettings.js').bind(client);

  var transactionSigner = require('./clientActions/transactionSigner.js');
  client.requestTransactionSignature = transactionSigner
    .requestTransactionSignature.bind(client);
  client.onTxRequest = function (message) {
    transactionSigner.transactionRequestHandler(hydrate(message));
  };

  client.onButtonRequest = function () {
    return client.writeToDevice(new client.protoBuf.ButtonAck());
  };

  client.onEntropyRequest = function (message) {
    var localEntropy = client.crypto.getLocalEntropy(32);
    var entropy = new client.protoBuf.EntropyAck(localEntropy);
    return client.writeToDevice(entropy);
  };

  client.onFeatures = function (message) {
    //TODO Factor featuresService out of client. It doesn't make sense for CLI.
    featuresService.setValue(message);
    walletNodeService.reloadBalances();
    return message;
  };

  client.onSuccess = function (message) {
    if (message.message.toLowerCase() === "firmware erased") {
      return client.firmwareUpload();
    } else {
      return client.initialize();
    }
  };

  client.onPublicKey = function (publicKeyObject) {
    //TODO Factor walletNodeService out of client. It doesn't make sense for CLI.
    walletNodeService.registerPublicKey(publicKeyObject);
  };

  // Poll for incoming messages
  client.devicePollingInterval = setInterval(function () {
    if (!deviceInUse) {
      deviceInUse = true;
      transport.read()
        .then(function dispatchIncomingMessage(message) {
          deviceInUse = false;
          logger.info('device --> proxy: [%s]\n', message.$type.name, JSON.stringify(message, buffer2Hex, config.jsonIndent));
          if (message) {

            client.eventEmitter.emit('DeviceMessage', message.$type.name, hydrate(message));

            var handler = 'on' + message.$type.name;
            if (client.hasOwnProperty(handler)) {
              return client[handler](message);
            } else {
              return message;
            }
          }
        })
        .catch(function() {
          logger.error('caught in client:', arguments);
        });
    }
  }, 0);

  client.stopPolling = function () {
    clearInterval(client.devicePollingInterval);
  };

  client.initialize()
    .catch(function () {
      logger.error('failure while initializing', arguments);
    });

  return client;
}

module.exports.create = function (transport, messagesProtoBuf) {
  var transportDeviceId = transport.getDeviceId();

  if (!clients.hasOwnProperty(transportDeviceId)) {
    clients[transportDeviceId] = clientMaker(transport, messagesProtoBuf);
  }

  return clients[transportDeviceId];
};

module.exports.factory = function (transport) {
  var deviceInfo = transport.getDeviceInfo(),
    deviceType = null;

  for (deviceType in DEVICES) {
    if (DEVICES[deviceType].vendorId === deviceInfo.vendorId &&
      DEVICES[deviceType].productId === deviceInfo.productId) {

      transport.setMessageMap(deviceType, clientTypes[deviceType].getProtoBuf());

      return clientTypes[deviceType].create(transport);
    }
  }
};

module.exports.find = function (transport) {
  var transportDeviceId = transport.getDeviceId();

  return clients[transportDeviceId];
};

module.exports.findByDeviceId = function (deviceId) {
  return clients[deviceId];
};

module.exports.remove = function (transport) {
  var transportDeviceId = transport.getDeviceId();

  clients[transportDeviceId].stopPolling();
  delete clients[transportDeviceId];
};

module.exports.getAllClients = function () {
  return Object.keys(clients).map(function (deviceId) {
    return clients[deviceId];
  });
};
