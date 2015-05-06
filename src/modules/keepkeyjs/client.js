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

    var ByteBuffer = require('bytebuffer');
    var extend = require('extend-object');
    var assert = require('assert');
    var uint32 = require('uint32');
    // bip39 = require('bip39'),
    var sprintf = require("sprintf-js").sprintf;
    var EventEmitter2 = require('eventemitter2').EventEmitter2;
    var hydrate = require('./hydrate.js');
    var crypto = window.crypto;

    var KEEPKEY = 'KEEPKEY';
    var TREZOR = 'TREZOR';
    var DEVICES = require('./transport.js').DEVICES;
    var PRIME_DERIVATION_FLAG = 0x80000000;

    module.exports.KEEPKEY = KEEPKEY;
    module.exports.TREZOR = TREZOR;

    var featuresService = {};
    featuresService.featuresPromise = new Promise(function(resolve) {
        featuresService.getPromise = function() {
            return featuresService.featuresPromise;
        };

        featuresService.setValue = function(value) {
            resolve(value);
        };
    });

    function getLocalEntropy() {
        var randArr = new Uint8Array(32);
        crypto.getRandomValues(randArr);
        return ByteBuffer.wrap(randArr);
    }


    function defaultMixin() {
        var that = {};  // create default ui mixin

        that.onButtonRequest = function () {
            return Promise.resolve(new (this.getProtoBuf().ButtonAck)());
        };

        that.onEntropyRequest = function(message) {
            this.writeToDevice(new (this.getProtoBuf()).EntropyAck(getLocalEntropy()));
        };

        that.onFeatures = function(rxMessage) {
            featuresService.setValue(rxMessage);
        };

        return that;
    }

    var clients = {},    // client pool
        clientTypes = {};  // client types used for client creation by type

    clientTypes[KEEPKEY] = require('./keepkey/client.js');
    clientTypes[TREZOR] = require('./trezor/client.js');

    function convertPrime(n) {
        var i = 0, max = n.length;

        for (; i < max; i += 1) {
            if (n[i] < 0) {
                n[i] = uint32.or(Math.abs(n[i]), PRIME_DERIVATION_FLAG);
            }
        }

        return n;
    }

    function clientMaker(transport, protoBuf) {

        var that = {};
        var featuresPromise = featuresService.getPromise();
        var deviceInUse = false;
        var decorators = {};
        var eventEmitter = new EventEmitter2();

        that.addListener = eventEmitter.addListener.bind(eventEmitter);
        that.writeToDevice = transport.write.bind(transport);

        // Poll for incoming messages
        that.devicePollingInterval = setInterval(function() {
            if (!deviceInUse) {
                transport.read()
                    .then(function dispatchIncomingMessage(message) {
                        console.log('msg:', message);
                        if (message) {

                            eventEmitter.emit('DeviceMessage', message.$type.name, hydrate(message));

                            var handler = 'on' + message.$type.name;
                            if (that.hasOwnProperty(handler)) {
                                return that[handler](message);
                            } else {
                                return message;
                            }
                        }
                    });
            }
        }, 1000);

        that.stopPolling = function() {
            clearInterval(that.devicePollingInterval);
        };

        that._setDeviceInUse = function (status) {
            return new Promise(function (resolve) {
                if (status) {
                    assert(!deviceInUse);
                }

                deviceInUse = status;
                resolve(deviceInUse);
            });
        };

        that._getDecorators = function () {
            return decorators;
        };

        that.getDeviceType = function () {
            throw {
                name: 'Error',
                message: 'getDeviceType not implemented.'
            };
        };

        that.getFeatures = function () {
            return featuresPromise;
        };

        that.getDeviceId = function () {
            return featuresPromise
                .then(function (features) {
                    return features.device_id;
                });
        };

        that.getProtoBuf = function () {
            return protoBuf;
        };

        that.call = function (txProtoMsg) {
            return that.txAndRxTransport(txProtoMsg)
                .then(function (rxProtoMsg) {
                    console.log('rxProtoMsg:', rxProtoMsg);
                    var handler = rxProtoMsg.$type.name;

                    console.log('handler:', handler);
                    if (that.hasOwnProperty('on' + handler)) {
                        return that['on' + handler](rxProtoMsg)
                            .then(function (handlerTxProtoMsg) {
                                return that.call(handlerTxProtoMsg);
                            });
                    } else {
                        return rxProtoMsg;
                    }
                })
                .catch(function () {
                    console.error('failure', arguments);
                });
        };

        that.txAndRxTransport = function (txProtoMsg) {
            return transport.write(txProtoMsg)
                .then(function() {
                    return transport.read();
                });
        };

        that.cancel = function () {
            return transport.write(new protoBuf.Cancel())
                .then(decorators.deviceReady);
        };

        that.initialize = function () {
            return that._setDeviceInUse(true)
                .then(transport.write.bind(this, new protoBuf.Initialize()))
                .then(decorators.deviceReady)
                .then(featuresService.getPromise);
        };

        that.getPublicNode = function (address_n) {
            return that._setDeviceInUse(true)
                .then(that.call.bind(this, new protoBuf.GetPublicKey(convertPrime(address_n))))
                .then(decorators.deviceReady)
                .then(decorators.expect('PublicKey'));
        };

        that.getAddress = function (args) {
            args = args || {};
            args.address_n = args.address_n || [];
            args.coin_name = args.coin_name || null;
            args.show_display = args.show_display || null;
            args.multisig = args.multisig || null;

            return that._setDeviceInUse(true)
                .then(that.call.bind(this, new protoBuf.GetAddress(
                    args.address_n, args.coin_name, args.show_display, args.multisig
                )))
                .then(decorators.deviceReady)
                .then(decorators.expect('Address'))
                .then(decorators.field('address'));
        };

        that.getEntropy = function (size) {
            return that.call(new protoBuf.GetEntropy(size))
                .then(decorators.expect('Entropy'))
                .then(decorators.field('entropy'));
        };

        that.ping = function (args) {
            args.message = args.message || '';
            args.button_protection = args.button_protection || false;
            args.pin_protection = args.pin_protection || false;
            args.passphrase_protection = args.passphrase_protection || false;

            return that._setDeviceInUse(true)
                .then(that.call.bind(this, new protoBuf.Ping(
                    args.message, args.button_protection, args.pin_protection, args.passphrase_protection
                )))
                .then(decorators.deviceReady)
                .then(decorators.expect('Success'))
                .then(decorators.field('message'));
        };

        that.applySettings = function (args) {
            args.language = args.language || null;
            args.label = args.label || null;
            args.use_passphrase = args.use_passphrase || null;

            return that.call(new protoBuf.ApplySettings(
                args.language, args.label, args.use_passphrase
            ))
                .then(decorators.expect('Success'))
                .then(decorators.field('message'));
        };

        that.clearSession = function () {
            return that.call(new protoBuf.ClearSession())
                .then(decorators.expect('Success'))
                .then(decorators.field('message'));
        };

        that.changePin = function (remove) {
            return that._setDeviceInUse(true)
                .then(that.call.bind(this, new protoBuf.ChangePin(remove)))
                .then(decorators.deviceReady, decorators.deviceReady)
                .then(decorators.expect('Success'))
                .then(decorators.field('message'))
                .then(decorators.refreshFeatures);
        };

        that.signMessage = function (args) {
            args.address_n = args.address_n || [];
            args.message = args.message || '';
            args.coin_name = args.coin_name || null;

            return that.call(new protoBuf.SignMessage(
                convertPrime(args.address_n), ByteBuffer.wrap(args.message.normalize('NFC')), args.coin_name
            ))
                .then(decorators.expect('MessageSignature'));
        };

        that.verifyMessage = function (args) {
            var messageBB = null;

            args.address = args.address || null;
            args.signature = args.signature || null;
            args.message = args.message || null;

            if (args.message !== null) {
                messageBB = ByteBuffer.wrap(args.message.normalize('NFC'));
            }

            return that.call(new protoBuf.VerifyMessage(
                args.address, args.signature, messageBB
            ))
                .then(function (rxProtoMsg) {
                    if (rxProtoMsg.$type.name === 'Success') {
                        return true;
                    } else {
                        return false;
                    }
                });

        };

        that.encryptMessage = function (args) {
            args.pubkey = args.pubkey || null;
            args.message = args.message || null;
            args.display_only = args.display_only || null;
            args.address_n = args.address_n || [];
            args.coin_name = args.coin_name || null;

            return that.call(new protoBuf.EncryptMessage(
                args.pubkey, ByteBuffer.wrap(args.message.normalize('NFC')), args.display_only,
                convertPrime(args.address_n), args.coin_name
            ))
                .then(decorators.expect('EncryptedMessage'));
        };

        that.decryptMessage = function (args) {
            args.address_n = args.address_n || [];
            args.nonce = args.nonce || null;
            args.message = args.message || null;
            args.hmac = args.hmac || null;

            return that.call(new protoBuf.DecryptMessage(
                convertPrime(args.address_n), args.nonce, args.message, args.hmac
            ))
                .then(decorators.expect('DecryptedMessage'));
        };

        that.encryptKeyValue = function (args) {
            args.address_n = args.address_n || [];
            args.key = args.key || null;
            args.value = args.value || null;
            args.ask_on_encrypt = args.ask_on_encrypt || true;

            return that.call(new protoBuf.CipherKeyValue(
                convertPrime(args.address_n), args.key, args.value, true, args.ask_on_encrypt, true
            ))
                .then(decorators.expect('CipheredKeyValue'))
                .then(decorators.field('value'));
        };

        that.decryptKeyValue = function (args) {
            args.address_n = args.address_n || [];
            args.key = args.key || null;
            args.value = args.value || null;
            args.ask_on_decrypt = args.ask_on_decrypt || true;

            return that.call(new protoBuf.CipherKeyValue(
                convertPrime(args.address_n), args.key, args.value, false, true, args.ask_on_decrypt
            ))
                .then(decorators.expect('CipheredKeyValue'))
                .then(decorators.field('value'));
        };

        that.estimateTxSize = function (args) {
            args.outputs_count = args.outputs_count || 0;
            args.inputs_count = args.inputs_count || 0;
            args.coin_name = args.coin_name || null;

            return that.call(new protoBuf.EstimateTxSize(args.outputs_count, args.inputs_count, args.coin_name))
                .then(decorators.expect('TxSize'))
                .then(decorators.field('tx_size'));
        };

        that.wipeDevice = function () {
            return that._setDeviceInUse(true)
                .then(that.call.bind(this, new protoBuf.WipeDevice()))
                .then(decorators.deviceReady)
                .then(decorators.expect('Success'))
                .then(decorators.field('message'))
                .then(decorators.refreshFeatures);
        };

        that.resetDevice = function (args) {
            console.log('resetting');
            args = args || {};
            args.display_random = args.display_random || null;
            args.strength = args.strength || null;
            args.passphrase_protection = args.passphrase_protection || null;
            args.pin_protection = args.pin_protection || null;
            args.language = args.language || null;
            args.label = args.label || null;

            return featuresPromise
                .then(function (features) {
                    if (!features.initialized) {
                        var message = new protoBuf.ResetDevice(
                            args.display_random, args.strength, args.passphrase_protection,
                            args.pin_protection, args.language, args.label
                        );
                        return transport.write(message);
                    } else {
                        return Promise.reject("Error: Expected features.initialized to be false: ", features);
                    }
                })
                .then(decorators.deviceReady)
                .catch(function () {
                    console.error('failure', arguments);
                });
        };

        that.pinMatrixAck = function(args) {
            return featuresPromise
                .then(function(features){
                    if (!features.initialized) {
                        var message = new protoBuf.PinMatrixAck(args.pin);
                        return transport.write(message);
                    } else {
                        return Promise.reject("Error: Expected features.initialized to be false: ", features);
                    }

                })
                .then(decorators.deviceReady)
                .catch(function () {
                    console.error('failure', arguments);
                });
        };

        that.recoveryDevice = function (args) {
            args = args || {};
            args.word_count = args.word_count || null;
            args.passphrase_protection = args.passphrase_protection || null;
            args.pin_protection = args.pin_protection || null;
            args.language = args.language || null;
            args.label = args.label || null;
            args.enforce_wordlist = args.enforce_wordlist || true;

            throw(new Error('Recovery device not implemented.'));
        };

        that.loadDeviceByMnemonic = function (args) {
            args.mnemonic = args.mnemonic || null;
            args.pin = args.pin || null;
            args.passphrase_protection = args.passphrase_protection || null;
            args.language = args.language || null;
            args.label = args.label || null;
            args.skip_checksum = args.skip_checksum || null;

            return that.call(new protoBuf.LoadDevice(
                args.mnemonic.normalize('NFC'), null, args.pin, args.passphrase_protection,
                args.language, args.label, args.skip_checksum
            ))
                .then(decorators.expect('Success'))
                .then(decorators.field('message'));
        };

        that.loadDeviceByXprv = function (args) {
            var hdNode = null;

            args.node = args.node || null;
            args.pin = args.pin || null;
            args.passphrase_protection = args.passphrase_protection || null;
            args.language = args.language || null;
            args.label = args.label || null;

            // copy hdnode information into protocol buffer object
            hdNode = new protoBuf.HDNodeType();
            hdNode.depth = args.node.depth;
            hdNode.fingerprint = args.node.parentFingerprint;
            hdNode.child_num = args.node.index;
            hdNode.chain_code = args.node.chainCode;
            hdNode.private_key = args.node.privKey.d.toBuffer();

            return that.call(new protoBuf.LoadDevice(
                null, hdNode, args.pin, args.passphrase_protection, args.language, args.label, null
            ))
                .then(decorators.expect('Success'))
                .then(decorators.field('message'));
        };

        decorators.expect = function (msgClass) {
            return function (rxProtoMsg) {
                var rxProtoMsgClass = rxProtoMsg.$type.name;

                if (rxProtoMsgClass !== msgClass) {
                    throw {
                        name: 'Error',
                        message: sprintf('Got %s, expected %s.', rxProtoMsgClass, msgClass)
                    };
                }

                return rxProtoMsg;
            };
        };

        decorators.field = function (msgField) {
            return function (rxProtoMsg) {
                if (!rxProtoMsg.hasOwnProperty(msgField)) {
                    throw {
                        name: 'Error',
                        message: sprintf('Message field "%s" not found in response.', msgField)
                    };
                }

                return rxProtoMsg[msgField];
            };
        };

        decorators.deviceReady = function (rxProtoMsg) {
            that._setDeviceInUse(false);
            return rxProtoMsg;
        };

        decorators.refreshFeatures = function (rxProtoMsg) {
            featuresPromise = that.initialize();
            return rxProtoMsg;
        };

        that.initialize()
            .catch(function () {
                console.error('failure while initializing', arguments);
            });

        return that;
    }

    module.exports.create = function (transport, messagesProtoBuf) {
        var transportDeviceId = transport.getDeviceId();

        if (!clients.hasOwnProperty(transportDeviceId)) {
            clients[transportDeviceId] = clientMaker(transport, messagesProtoBuf);

            // extend client with default mixin
            extend(clients[transportDeviceId], defaultMixin());
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

})();