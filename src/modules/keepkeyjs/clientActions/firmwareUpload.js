var firmwareFileMetaData = require('../../../../tmp/keepkey_main.js');
var featuresService = require('../simpleGlobalStore.js');
var ByteBuffer = require('bytebuffer');
var crypto = window.crypto;

var client;

function checkDeviceInBootloaderMode(features) {
    return featuresService.getPromise()
        .then(function (features) {
            return new Promise(function (resolve, reject) {
                if (!features.bootloader_mode) {
                    reject('Device must be in bootloader mode');
                } else {
                    resolve();
                }
            });
        });
}


function loadFirmwareFile() {
    return new Promise(function (resolve, reject) {
        var myRequest = new XMLHttpRequest();
        myRequest.onloadend = function () {
            resolve(ByteBuffer.wrap(this.response));
        };
        myRequest.open('GET', firmwareFileMetaData.file, true);
        myRequest.responseType = 'arraybuffer';
        myRequest.send();
    });
}

function validateFirmwareFileSize(fileContent) {
    return new Promise(function (resolve, reject) {
        if (fileContent.limit !== firmwareFileMetaData.size) {
            reject([
                "Size of firmware file",
                "(" + fileContent.limit + ")",
                "doesn't match the expected size of",
                firmwareFileMetaData.size
            ].join(' '));
        } else {
            resolve(fileContent);
        }
    });
}

function getHashHex(payload, expectedHash) {
    return crypto.subtle.digest('SHA-256', payload.toArrayBuffer())
        .then(function (hash) {
            return ByteBuffer.wrap(hash).toHex();
        });
}

function checkHash(hashName, hash, expectedHash) {
    console.log(hashName + ":", hash);
    return new Promise(function confirmFileDigest(resolve, reject) {
        if (hash !== expectedHash) {
            reject(hashName, "doesn't match expected value");
        } else {
            resolve();
        }
    });
}

function validateFirmwareFileDigest(payload) {
    var eventPayload = {};

    var firmwarePayloadDigestPromise = getHashHex(payload.slice(256))
        .then(function (hash) {
            eventPayload.imageHashCodeTrezor = hash;
            return checkHash("firmware payload digest", hash, firmwareFileMetaData.trezorDigest);
        });

    var firmwareImageDigestPromise = getHashHex(payload)
        .then(function (hash) {
            eventPayload.imageHashCode = hash;
            return checkHash("firmware image digest", hash, firmwareFileMetaData.digest);
        });

    return Promise.all([firmwarePayloadDigestPromise, firmwareImageDigestPromise])
        .then(function () {
            client.eventEmitter.emit('DeviceMessage', 'ImageHashCode', eventPayload);
            return payload;
        });
}

function verifyManufacturerPrefixInFirmwareImage(payload) {
    return new Promise(function (resolve, reject) {
        var firmwareManufacturerTag = payload.readString(4);
        payload.reset();

        if (firmwareManufacturerTag === 'KPKY') {
            resolve(payload);
        } else {
            reject('Firmware image is from an unknown manufacturer. Unable to upload to the device.');
        }
    });
}

function sendFirmwareToDevice(payload) {
    var message = new client.protoBuf.FirmwareUpload(payload);
    return client.writeToDevice(message);
}

module.exports = function firmwareUpload(args) {
    client = this;
    return checkDeviceInBootloaderMode()
        .then(loadFirmwareFile)
        .then(validateFirmwareFileSize)
        .then(validateFirmwareFileDigest)
        .then(verifyManufacturerPrefixInFirmwareImage)
        .then(sendFirmwareToDevice)
        .catch(function (message) {
            console.log(message);
            console.log('failure while uploading new binary image');
            // TODO Send a message to the client
        });
};