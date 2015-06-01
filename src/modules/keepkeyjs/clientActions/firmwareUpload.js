var firmwareFileMetaData = require('../../../../tmp/keepkey_main.js');
var featuresService = require('../featuresService.js');
var ByteBuffer = require('bytebuffer');
var readFirmwareFile = require('./readFirmwareFile.js');
var logger = require('../../../logger.js');

var digest = require('../digest.js');

var client;

var firmwareImageDigestPromise, firmwarePayloadDigestPromise;

function checkDeviceInBootloaderMode(features) {
    logger.debug('check for device in bootloader mode');
    return featuresService.getPromise()
        .then(function (features) {
            return new Promise(function (resolve, reject) {
                if (!features.bootloader_mode) {
                    reject('Device must be in bootloader mode');
                } else {
                    resolve(firmwareFileMetaData.file);
                }
            });
        });
}


function validateFirmwareFileSize(fileContent) {
    logger.debug('verifying the that file size is correct');
    return new Promise(function (resolve, reject) {
        if (fileContent.byteLength !== firmwareFileMetaData.size) {
            reject([
                "Size of firmware file",
                "(" + fileContent.byteLength + ")",
                "doesn't match the expected size of",
                firmwareFileMetaData.size
            ].join(' '));
        } else {
            resolve(fileContent);
        }
    });
}

function getHashHex(payload) {
    return digest("SHA-256", payload).then(function (hash) {
        return hash;
    });
}

function checkHash(hashName, hash, expectedHash) {
    var hexHash = ByteBuffer.wrap(hash).toHex();
    logger.debug('verifying %s: expecting %s', hashName, expectedHash);
    logger.info(hashName + ":", hexHash);
    return new Promise(function confirmFileDigest(resolve, reject) {
        if (hexHash !== expectedHash) {
            reject(hashName, "doesn't match expected value");
        } else {
            resolve(hash);
        }
    });
}

function validateFirmwareFileDigest(payload) {
    logger.debug('verifying firmware hashcodes');

    firmwarePayloadDigestPromise = getHashHex(payload.slice(256))
        .then(function (hash) {
            return checkHash("firmware payload digest", hash, firmwareFileMetaData.trezorDigest);
        });

    firmwareImageDigestPromise = getHashHex(payload)
        .then(function (hash) {
            return checkHash("firmware image digest", hash, firmwareFileMetaData.digest);
        });

    return Promise.all([firmwarePayloadDigestPromise, firmwareImageDigestPromise])
        .then(function (values) {
            client.eventEmitter.emit('DeviceMessage', 'ImageHashCode', {
                imageHashCodeTrezor: values[0],
                imageHashCode: values[1]
            });

            return payload;
        });
}

function verifyManufacturerPrefixInFirmwareImage(payload) {
    logger.debug('verifying manufacturers prefix in firmware file');
    return new Promise(function (resolve, reject) {
        var firmwareManufacturerTag = ByteBuffer.wrap(payload.slice(0,4)).toString('utf8');
        if (firmwareManufacturerTag === 'KPKY') {
            resolve(payload);
        } else {
            reject('Firmware image is from an unknown manufacturer. Unable to upload to the device.');
        }
    });
}

function sendFirmwareToDevice(payload) {
    logger.debug('sending firmware to device');
    return firmwareImageDigestPromise.then(function(hash) {
        var message = new client.protoBuf.FirmwareUpload(
            ByteBuffer.wrap(hash), ByteBuffer.wrap(payload));
        return client.writeToDevice(message);
    });
}

module.exports = function firmwareUpload() {
    client = this;
    logger.debug('starting firmware upload');
    return checkDeviceInBootloaderMode()
        .then(readFirmwareFile)
        .then(validateFirmwareFileSize)
        .then(validateFirmwareFileDigest)
        .then(verifyManufacturerPrefixInFirmwareImage)
        .then(sendFirmwareToDevice)
        .catch(function (message) {
            logger.error('failure while uploading new binary image:', message);
            // TODO Send a message to the client
            return Promise.reject(message);
        });
};