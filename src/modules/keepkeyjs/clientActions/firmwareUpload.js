var ByteBuffer = require('bytebuffer');
var _ = require('lodash');

var firmwareFileMetaData = require('../../../../tmp/keepkey_main.js');
var featuresService = require('../featuresService.js');
var logger = require('../../../logger.js');

var client;

var firmwareFilePromise, firmwareImageHash;

function checkDeviceInBootloaderMode(features) {
  logger.info('check for device in bootloader mode');
  if (!features.bootloader_mode) {
    return Promise.reject('Device must be in bootloader mode');
  } else {
    return Promise.resolve(firmwareFileMetaData.file);
  }
}

function validateFirmwareFileSize(fileContent) {
  if (fileContent.byteLength === firmwareFileMetaData.size) {
    return Promise.reject([
      "Size of firmware file",
      "(" + fileContent.byteLength + ")",
      "doesn't match the expected size of",
      firmwareFileMetaData.size
    ].join(' '));
  } else {
    return Promise.resolve(fileContent);
  }
}

function checkHash(hash, hashName, expectedHash) {
  var hexHash = ByteBuffer.wrap(hash).toHex();
  logger.info('verifying %s: expecting %s', hashName, expectedHash);
  logger.info(hashName + ":", hexHash);
  if (hexHash !== expectedHash) {
    return Promise.reject(hashName, "doesn't match expected value");
  } else {
    return Promise.resolve(hash);
  }
}

function validateFirmwarePayloadDigest() {
  var checkPayloadHash = _.curryRight(checkHash)
  ("firmware payload digest", firmwareFileMetaData.trezorDigest);

  logger.info('verifying firmware payload hashcode');

  return firmwareFilePromise
    .then(function (payload) {
      return client.crypto.digest("SHA-256", payload.slice(256));
    })
    .then(checkPayloadHash);
}

function validateFirmwareImageDigest() {
  var checkImageHash = _.curryRight(checkHash)
  ("firmware image digest", firmwareFileMetaData.digest);

  logger.info('verifying firmware image hashcode');

  return firmwareFilePromise
    .then(function (payload) {
      return client.crypto.digest("SHA-256", payload);
    })
    .then(checkImageHash);
}

function verifyManufacturerPrefixInFirmwareImage() {
  logger.info('verifying manufacturers prefix in firmware file');

  return firmwareFilePromise
    .then(function (payload) {
      var firmwareManufacturerTag = ByteBuffer
        .wrap(payload.slice(0, 4))
        .toString('utf8');
      if (firmwareManufacturerTag === 'KPKY') {
        return Promise.resolve(payload);
      } else {
        return Promise.reject(
          'Firmware image is from an unknown manufacturer. Unable to upload to the device.');
      }
    });
}

function sendFirmwareToDevice() {
  logger.info('sending firmware to device');

  return firmwareFilePromise
    .then(function(payload) {
      return client.writeToDevice(new client.protoBuf.FirmwareUpload(
        ByteBuffer.fromHex(firmwareFileMetaData.digest),
        ByteBuffer.wrap(payload)));
    });
}

function readFirmwareFile() {
  firmwareFilePromise = client.readFirmwareFile(
    firmwareFileMetaData.file);
  return firmwareFilePromise;
}

function eraseFirmware() {
  logger.info('erasing firmware');
  return client.writeToDevice(new client.protoBuf.FirmwareErase());
}

function clearFeatures() {
  featuresService.clear();
}

function reloadFeatures() {

}

module.exports = function firmwareUpload() {
  client = this;
  logger.info('starting firmware upload');
  return featuresService.getPromise()
    .then(checkDeviceInBootloaderMode)
    .then(readFirmwareFile)
    .then(validateFirmwareFileSize)
    .then(validateFirmwarePayloadDigest)
    .then(validateFirmwareImageDigest)
    .then(verifyManufacturerPrefixInFirmwareImage)
    .catch(function() {
      logger.error('Firmware metadata doesn\'t match firmware file');
    })
    .then(eraseFirmware)
    .then(featuresService.clear)
    .then(sendFirmwareToDevice)
    .catch(function (message) {
      logger.error('failure while uploading new binary image:', message);
      // TODO Send a message to the client
      return Promise.reject(message);
    });
};