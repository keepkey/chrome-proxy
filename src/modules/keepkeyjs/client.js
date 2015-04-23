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

    /////////////
    // REQUIRE //
    /////////////

    var ByteBuffer = require('bytebuffer'),
        assert = require('assert'),
        uint32 = require('uint32'),
        bip39 = require('bip39'),
        sprintf = require("sprintf-js").sprintf;

    var KEEPKEY = 'KEEPKEY',
        TREZOR = 'TREZOR',
        DEVICES = require('./transport.js').DEVICES,
        PRIME_DERIVATION_FLAG = 0x80000000;

    module.exports.KEEPKEY = KEEPKEY;
    module.exports.TREZOR = TREZOR;

    var clients = {},    // client pool
        clientTypes = {},  // client types used for client creation by type
        decorators = {};   // decorators to check and format responses from device

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

        var that = {},                          // new client object
            msgHandlers = {},                     // message handlers
            commands = {},                        // seperate object holds commands so they are private to client consumer
            clientPromise = Promise.resolve(),    // makes sure that commands against device look synchronous
            features = {};                        // device features

        msgHandlers.ButtonRequest = function () {
            return new protoBuf.ButtonAck();
        };

        that.getDeviceType = function () {
            throw {
                name: 'Error',
                message: 'getDeviceType not implemented.'
            };
        };

        that.getFeatures = function () {
            clientPromise = clientPromise
                .then(function () {
                    return features;
                });
            return clientPromise;
        };

        that.getDeviceId = function () {
            clientPromise = clientPromise
                .then(function () {
                    return features.device_id;
                });
            return clientPromise;
        };

        that.call = function (txProtoMsg) {
            return Promise.resolve(txProtoMsg)
                .then(that.txAndRxTransport)
                .then(function (rxProtoMsg) {
                    var handler = rxProtoMsg.$type.name;

                    if (msgHandlers.hasOwnProperty(handler)) {
                        return that.call(msgHandlers[handler](rxProtoMsg));
                    } else {
                        return rxProtoMsg;
                    }
                });
        };

        that.txAndRxTransport = function (txProtoMsg) {
            return transport.write(txProtoMsg)
                .then(transport.read);
        };

        that.ready = function () {
            var revealedCommands = {},
                availableCommand = null,
                reveal = function (command) {    // wrapper around command that enforces promise
                    return function (args) {
                        var commandPromise = clientPromise
                            .then(commands[command].bind(this, args));

                        // reset client promise to last run promise
                        clientPromise = commandPromise;

                        // determine if features need to be refreshed after command run
                        // and if so reset client promise to new features promise
                        if (commands[command].hasOwnProperty('refreshFeatures') && commands[command].refreshFeatures) {
                            clientPromise = clientPromise
                                .then(commands.initialize);
                        }

                        // return command promise and not client promise, since commitments could have been added
                        // to the client promise
                        return commandPromise;
                    };
                };

            // loop through available comands and reveal them
            for (availableCommand in commands) {
                if (commands.hasOwnProperty(availableCommand)) {
                    revealedCommands[availableCommand] = reveal(availableCommand);
                }
            }

            // cache revealed commands by rewriting ready
            that.ready = function () {
                return revealedCommands;
            };

            return revealedCommands;
        };

        commands.initialize = function () {
            return that.call(new protoBuf.Initialize())
                .then(decorators.expect('Features'))
                .then(function (rxProtoMsg) {
                    features = rxProtoMsg;
                    return rxProtoMsg;
                });
        };

        commands.getPublicNode = function (address_n) {
            return that.call(new protoBuf.GetPublicKey(convertPrime(address_n)))
                .then(decorators.expect('PublicKey'));
        };

        commands.getAddress = function (args) {
            args = args || {};
            args.address_n = args.address_n || [];
            args.coin_name = args.coin_name || null;
            args.show_display = args.show_display || null;
            args.multisig = args.multisig || null;

            return that.call(new protoBuf.GetAddress(
                args.address_n, args.coin_name, args.show_display, args.multisig
            ))
                .then(decorators.expect('Address'))
                .then(decorators.field('address'));
        };

        commands.getEntropy = function (size) {
            return that.call(new protoBuf.GetEntropy(size))
                .then(decorators.expect('Entropy'))
                .then(decorators.field('entropy'));
        };

        commands.ping = function (args) {
            args.message = args.message || '';
            args.button_protection = args.button_protection || false;
            args.pin_protection = args.pin_protection || false;
            args.passphrase_protection = args.passphrase_protection || false;

            return that.call(new protoBuf.Ping(
                args.message, args.button_protection, args.pin_protection, args.passphrase_protection
            ))
                .then(decorators.expect('Success'))
                .then(decorators.field('message'));
        };

        commands.applySettings = function (args) {
            args.language = args.language || null;
            args.label = args.label || null;
            args.use_passphrase = args.use_passphrase || null;

            return that.call(new protoBuf.ApplySettings(
                args.language, args.label, args.use_passphrase
            ))
                .then(decorators.expect('Success'))
                .then(decorators.field('message'));
        };

        commands.clearSession = function () {
            return that.call(new protoBuf.ClearSession())
                .then(decorators.expect('Success'))
                .then(decorators.field('message'));
        };

        commands.signMessage = function (args) {
            args.address_n = args.address_n || [];
            args.message = args.message || '';
            args.coin_name = args.coin_name || null;

            return that.call(new protoBuf.SignMessage(
                convertPrime(args.address_n), ByteBuffer.wrap(args.message.normalize('NFC')), args.coin_name
            ))
                .then(decorators.expect('MessageSignature'));
        };

        commands.verifyMessage = function (args) {
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
                    return (rxProtoMsg.$type.name === 'Success');
                });

        };

        commands.encryptMessage = function (args) {
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

        commands.decryptMessage = function (args) {
            args.address_n = args.address_n || [];
            args.nonce = args.nonce || null;
            args.message = args.message || null;
            args.hmac = args.hmac || null;

            return that.call(new protoBuf.DecryptMessage(
                convertPrime(args.address_n), args.nonce, args.message, args.hmac
            ))
                .then(decorators.expect('DecryptedMessage'));
        };

        commands.encryptKeyValue = function (args) {
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

        commands.decryptKeyValue = function (args) {
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

        commands.estimateTxSize = function (args) {
            args.outputs_count = args.outputs_count || 0;
            args.inputs_count = args.inputs_count || 0;
            args.coin_name = args.coin_name || null;

            return that.call(new protoBuf.EstimateTxSize(args.outputs_count, args.inputs_count, args.coin_name))
                .then(decorators.expect('TxSize'))
                .then(decorators.field('tx_size'));
        };

        commands.wipeDevice = function () {
            return that.call(new protoBuf.WipeDevice())
                .then(decorators.expect('Success'))
                .then(decorators.field('message'));
        };

        commands.resetDevice = function (args) {
            args = args || {};
            args.display_random = args.display_random || null;
            args.strength = args.strength || null;
            args.passphrase_protection = args.passphrase_protection || null;
            args.pin_protection = args.pin_protection || null;
            args.language = args.language || null;
            args.label = args.label || null;

            assert(features.initialized === false);

            return that.call(new protoBuf.ResetDevice(
                args.display_random, args.strength, args.passphrase_protection,
                args.pin_protection, args.language, args.label
            ))

                // receive entropy request and respond with local machine entropy
                .then(decorators.expect('EntropyRequest'))
                .then(that.call.bind(this, new protoBuf.EntropyAck(getLocalEntropy())))

                // receive success message and refresh features
                .then(decorators.expect('Success'))
                .then(decorators.field('message'));
        };

        commands.loadDeviceByMnemonic = function (args) {
            args.mnemonic = args.mnemonic || null;
            args.pin = args.pin || null;
            args.passphrase_protection = args.passphrase_protection || null;
            args.language = args.language || null;
            args.label = args.label || null;
            args.skip_checksum = args.skip_checksum || null;

            assert(features.initialized === false);
            assert(bip39.validateMnemonic(args.mnemonic));

            return that.call(new protoBuf.LoadDevice(
                args.mnemonic.normalize('NFC'), null, args.pin, args.passphrase_protection,
                args.language, args.label, args.skip_checksum
            ))
                .then(decorators.expect('Success'))
                .then(decorators.field('message'));
        };

        commands.loadDeviceByXprv = function (args) {
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

            assert(features.initialized === false);

            return that.call(new protoBuf.LoadDevice(
                null, hdNode, args.pin, args.passphrase_protection, args.language, args.label, null
            ))
                .then(decorators.expect('Success'))
                .then(decorators.field('message'));
        };

        commands.applySettings.refreshFeatures = true;
        commands.wipeDevice.refreshFeatures = true;
        commands.resetDevice.refreshFeatures = true;
        commands.resetDevice.loadDeviceByMnemonic = true;
        commands.resetDevice.loadDeviceByXprv = true;

        that.ready().initialize();

        return that;
    }

    function getLocalEntropy() {
        var randArr = new Uint8Array(32);
        /* global window */
        window.crypto.getRandomValues(randArr);
        return ByteBuffer.wrap(randArr);
    }

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

        // find matching vendor and product id and return
        // matched type
        for (deviceType in DEVICES) {
            if (DEVICES[deviceType].vendorId === deviceInfo.vendorId &&
                DEVICES[deviceType].productId === deviceInfo.productId) {

                return clientTypes[deviceType].create(transport);
            }
        }
    };

    module.exports.find = function (transport) {
        var transportDeviceId = transport.getDeviceId();

        return clients[transportDeviceId];
    };

    module.exports.remove = function (transport) {
        var transportDeviceId = transport.getDeviceId();

        delete clients[transportDeviceId];
    };

})();