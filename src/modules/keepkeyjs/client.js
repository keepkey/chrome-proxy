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

  var ByteBuffer = require('bytebuffer'),
    assert = require('assert'),
    uint32 = require('uint32'),
    bip39 = require('bip39'),
    sprintf = require("sprintf-js").sprintf;

  ///////////////
  // CONSTANTS //
  ///////////////

  var KEEPKEY = 'KEEPKEY',
    TREZOR = 'TREZOR',
    DEVICES = require('./transport.js').DEVICES,
    PRIME_DERIVATION_FLAG = 0x80000000;

  module.exports.KEEPKEY = KEEPKEY;
  module.exports.TREZOR = TREZOR;
  
  //////////////////////////////
  // PRIVATE STATIC VARIABLES //
  //////////////////////////////

	var clients = {},    // client pool
    clientTypes = {},  // client types used for client creation by type
    decorators = {};   // decorators to check and format responses from device

  clientTypes[KEEPKEY] = require('./keepkey/client.js');
  clientTypes[TREZOR] = require('./trezor/client.js');

  ////////////////////////////
  // PRIVATE STATIC METHODS //
  ////////////////////////////

  /**
   * Convert minus signs to uint32 with flag
   * @param  {Array} n  array of numbers to convert
   * @return {Array}
   */
  function convertPrime(n) {
    var i = 0, max = n.length;

    for(; i < max; i += 1) {
      if(n[i] < 0) {
        n[i] = uint32.or(Math.abs(n[i]), PRIME_DERIVATION_FLAG);
      }
    }

    return n;
  }

  /**
   * Creates a new client object
   * @param  {Transport}  transport  transport object for connected device
   * @param  {ProtoBuf}   protoBuf   device specific protocol buffers
   * @return {Client}
   */
	function clientMaker(transport, protoBuf) {

    ///////////////////////
    // PRIVATE VARIABLES //
    ///////////////////////

    var that = {},                          // new client object
      msgHandlers = {},                     // message handlers
      commands = {},                        // seperate object holds commands so they are private to client consumer
      clientPromise = Promise.resolve(),    // makes sure that commands against device look synchronous
      features = {};                        // device features

    /////////////////////
    // PRIVATE METHODS //
    /////////////////////

    //////////////////////
    // MESSAGE HANDLERS //
    //////////////////////

    /**
     * Handles button request by sending a button acknowledgment
     * @return {ProtoBuf}
     */
    msgHandlers.ButtonRequest = function() {
      return new protoBuf.ButtonAck();
    };

    ////////////////////
    // PUBLIC METHODS //
    ////////////////////

    /**
     * Returns the type of the connected device.
     * @return {String}
     */
    that.getDeviceType = function() {
      throw {
        name: 'Error',
        message: 'getDeviceType not implemented.'
      };
    };

    /**
     * Returns connected device's features
     * @return {Promise}
     */
    that.getFeatures = function () {
      clientPromise = clientPromise
        .then(function() {
          return features;
        });
      return clientPromise;
    };

    /**
     * Returns connected device's id
     * (this is different than the transport device id)
     * @return {Promise}
     */
    that.getDeviceId = function () {
      clientPromise = clientPromise
        .then(function() {
          return features.device_id;
        });
      return clientPromise;
    };

    /**
     * Calls and handles protocol buffer messages.
     * @param  {ProtoBuf} protoMsg  protocol buffer message
     * @return {Promise}
     */
    that.call = function(txProtoMsg) {
      return Promise.resolve(txProtoMsg)
        .then(that.txAndRxTransport)
        .then(function(rxProtoMsg) {
          var handler = rxProtoMsg.$type.name;

          if(msgHandlers.hasOwnProperty(handler)) {
            return that.call(msgHandlers[handler](rxProtoMsg));
          } else {
            return rxProtoMsg;
          }
        });
    };

    /**
     * On the client's transport a session is started, the protocol buffer is
     * written out, and the session is them closed
     * @param  {ProtoBuf} txProtoMsg  protocol buffer message
     * @return {Promise}
     */
    that.txAndRxTransport = function(txProtoMsg) {
      return transport.write(txProtoMsg)
        .then(transport.read);
    };

    /**
     * Wraps available commands in a promise, making sure that commands are processed
     * sequentially without user's intervention
     * @return {Object}
     */
    that.ready = function() {
      var revealedCommands = {}, 
        availableCommand = null,
        reveal = function(command) {    // wrapper around command that enforces promise
          return function(args) {
            var commandPromise = clientPromise
              .then(commands[command].bind(this, args));

            // reset client promise to last run promise
            clientPromise = commandPromise;

            // determine if features need to be refreshed after command run
            // and if so reset client promise to new features promise
            if(commands[command].hasOwnProperty('refreshFeatures') && commands[command].refreshFeatures) {
              clientPromise = clientPromise
                .then(commands.initialize);
            }

            // return command promise and not client promise, since commitments could have been added
            // to the client promise
            return commandPromise;
          };
        };

      // loop through available comands and reveal them
      for(availableCommand in commands) {
        if(commands.hasOwnProperty(availableCommand)) {
          revealedCommands[availableCommand] = reveal(availableCommand);
        }
      }

      // cache revealed commands by rewriting ready
      that.ready = function() {
        return revealedCommands;
      };

      return revealedCommands;
    };    

    /////////////////////
    // CLIENT COMMANDS //
    /////////////////////

    /**
     * Reset device to default state and ask for device details
     * @return {Promise}
     */
    commands.initialize = function() {
      return that.call(new protoBuf.Initialize())
        .then(decorators.expect('Features'))
        .then(function(rxProtoMsg) {
          features = rxProtoMsg;
          return rxProtoMsg;
        });
    };

    /**
     * Ask device for public key corresponding to address_n path
     * @param  {Array}  address_n   BIP-32 path to derive the key from master node
     * @return {Promise}
     */
    commands.getPublicNode = function(address_n) {
      return that.call(new protoBuf.GetPublicKey(convertPrime(address_n)))
        .then(decorators.expect('PublicKey'));
    };

    /**
     * Returns a bitcoin address in base58 encoding.
     * @param  {Integer}                  args.address_n    BIP-32 path to derive the key from master node
     * @param  {String}                   args.coin_name    coin type to use
     * @param  {Bool}                     args.show_display display address on device
     * @param  {MultisigRedeemScriptType} args.multisig     Filled if we are showing a multisig address
     * @return {Promise}
     */
		commands.getAddress = function(args) {
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

		/**
     * Request a sample of random data generated by hardware RNG. May be used for testing.
     * @param  {Integer}  size  size of requested entropy
     * @return {Promise}
     */
    commands.getEntropy = function(size) {
      return that.call(new protoBuf.GetEntropy(size))
        .then(decorators.expect('Entropy'))
        .then(decorators.field('entropy'));
		};

    /**
     * Test if the device is alive, device sends back the message in Success response
     * @param  {String}   args.messages               message to send back in Success message
     * @param  {Bool}     args.button_protection      ask for button press
     * @param  {Bool}     args.pin_protection         ask for PIN if set in device
     * @param  {Bool}     args.passphrase_protection  ask for passphrase if set in device
     * @return {Promise}
     */
    commands.ping = function(args) {
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

    /**
     * Change language and/or label of the device
     * @param  {String}   args.language         language to apply
     * @param  {String}   args.label            label to apply
     * @param  {Bool}     args.use_passphrase   enable or disable passphrase
     * @return {Promise}
     */
    commands.applySettings = function(args) {
      args.language = args.language || null;
      args.label = args.label || null;
      args.use_passphrase = args.use_passphrase || null;

      return that.call(new protoBuf.ApplySettings(
          args.language, args.label, args.use_passphrase
        ))
        .then(decorators.expect('Success'))
        .then(decorators.field('message'));
    };

    /**
     * Clear session (removes cached PIN, passphrase, etc).
     * @return {Promise}
     */
    commands.clearSession = function() {
      return that.call(new protoBuf.ClearSession())
        .then(decorators.expect('Success'))
        .then(decorators.field('message'));
    };

    /**
     * Ask device to sign message
     * @param  {Array}    args.address_n  BIP-32 path to derive the key from master node
     * @param  {String}   args.message    message to be signed
     * @param  {String}   args.coin_name  coin to use for signing
     * @return {Promise}
     */
    commands.signMessage = function(args) {
      args.address_n = args.address_n || [];
      args.message = args.message || '';
      args.coin_name = args.coin_name || null;

      return that.call(new protoBuf.SignMessage(
          convertPrime(args.address_n), ByteBuffer.wrap(args.message.normalize('NFC')), args.coin_name
        ))
        .then(decorators.expect('MessageSignature'));
    };

    /**
     * Ask device to verify message
     * @param  {String}       args.address    address to verify
     * @param  {ByteBuffer}   args.signature  signature to verify
     * @param  {String}       args.message    message to verify
     * @return {Promise}
     */
    commands.verifyMessage = function(args) {
      var messageBB = null;

      args.address = args.address || null;
      args.signature = args.signature || null;
      args.message = args.message || null;

      if(args.message !== null) {
        messageBB = ByteBuffer.wrap(args.message.normalize('NFC'));
      }

      return that.call(new protoBuf.VerifyMessage(
          args.address, args.signature, messageBB
        ))
        .then(function(rxProtoMsg) {
          return (rxProtoMsg.$type.name === 'Success');
        });

    };

    /**
     * Ask device to encrypt message
     * @param  {ByteBuffer}  args.pubkey        public key
     * @param  {String}      args.message       message to encrypt
     * @param  {Bool}        args.display_only  show just on display? (don't send back via wire)
     * @param  {Array}       args.address_n     BIP-32 path to derive the signing key from master node
     * @param  {String}      args.coin_name     coin to use for signing
     * @return {Promise}
     */
    commands.encryptMessage = function(args) {
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

    /**
     * Ask device to decrypt message
     * @param  {Array}       args.address_n   BIP-32 path to derive the decryption key from master node
     * @param  {ByteBuffer}  args.nonce       nonce used during encryption
     * @param  {ByteBuffer}  args.message     message to decrypt
     * @param  {ByteBuffer}  args.hmac        message hmac
     * @return {Promise}
     */
    commands.decryptMessage = function(args) {
      args.address_n = args.address_n || [];
      args.nonce = args.nonce || null;
      args.message = args.message || null;
      args.hmac = args.hmac|| null;

      return that.call(new protoBuf.DecryptMessage(
          convertPrime(args.address_n), args.nonce, args.message, args.hmac
        ))
        .then(decorators.expect('DecryptedMessage'));
    };

    /**
     * Ask device to encrypt value of given key
     * @param  {Array}      args.address_n        BIP-32 path to derive the key from master node
     * @param  {String}     args.key              key component of key:value
     * @param  {ByteBuffer} args.value            value component of key:value
     * @param  {Bool}       args.ask_on_encrypt   should we ask on encrypt operation?
     * @return {Promise}
     */
    commands.encryptKeyValue = function(args) {
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

    /**
     * Ask device to decrypt value of given key
     * @param  {Array}      args.address_n        BIP-32 path to derive the key from master node
     * @param  {String}     args.key              key component of key:value
     * @param  {ByteBuffer} args.value            value component of key:value
     * @param  {Bool}       args.ask_on_decrypt   should we ask on decrypt operation?
     * @return {Promise}
     */
    commands.decryptKeyValue = function(args) {
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

    /**
     * Estimated size of the transaction
     * @param  {Integer}  args.outputs_count    number of transaction outputs
     * @param  {Integer}  args.inputs_count     number of transaction inputs
     * @param  {String}   args.coin_name        coin to use
     * @return {Promise}
     */
    commands.estimateTxSize = function(args) {
      args.outputs_count = args.outputs_count || 0;
      args.inputs_count = args.inputs_count || 0;
      args.coin_name = args.coin_name || null;

      return that.call(new protoBuf.EstimateTxSize(args.outputs_count, args.inputs_count, args.coin_name))
        .then(decorators.expect('TxSize'))
        .then(decorators.field('tx_size'));
    };

    /**
     * Request device to wipe all sensitive data and settings
     * @return {Promise}
     */
    commands.wipeDevice = function() {
      return that.call(new protoBuf.WipeDevice())
        .then(decorators.expect('Success'))
        .then(decorators.field('message'));
    };

    /**
     * Ask device to do initialization involving user interaction
     * @param  {Bool}     args.display_random         display entropy generated by the device before asking for additional entropy
     * @param  {Integerl} args.strength               strength of seed in bits
     * @param  {Bool}     args.passphrase_protection  enable master node encryption using passphrase
     * @param  {Bool}     args.pin_protection         enable PIN protection
     * @param  {String}   args.language               device label
     * @param  {String}   args.label                  device label
     * @return {Promise}
     */
    commands.resetDevice = function(args) {
      args = args || {};
      args.display_random = args.display_random || null;
      args.strength = args.strength || null;
      args.passphrase_protection = args.passphrase_protection || null;
      args.pin_protection = args.pin_protection || null;
      args.language = args.language || null;
      args.label= args.label || null;

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

    /**
     * Load seed and related internal settings from the computer
     * @param  {String} args.mnemonic               seed encoded as BIP-39 mnemonic (12, 18 or 24 words)
     * @param  {String} args.pin                    set PIN protection
     * @param  {Bool}   args.passphrase_protection  enable master node encryption using passphrase
     * @param  {String} args.language               device language
     * @param  {String} args.label                  device label
     * @param  {Bool}   args.skip_checksum          do not test mnemonic for valid BIP-39 checksum
     * @return {Promise}
     */
    commands.loadDeviceByMnemonic = function(args) {
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

    /**
     * Load xprv and related internal settings from the computer
     * @param  {HDNode} args.node                   BIP-32 node
     * @param  {String} args.pin                    set PIN protection
     * @param  {Bool}   args.passphrase_protection  enable master node encryption using passphrase
     * @param  {String} args.language               device language
     * @param  {String} args.label                  device label
     * @return {Promise}
     */
    commands.loadDeviceByXprv = function(args) {
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

    /**
     * If set, features will be refreshed after command is called
     * @type {Boolean}
     */
    commands.applySettings.refreshFeatures = true;
    commands.wipeDevice.refreshFeatures = true;
    commands.resetDevice.refreshFeatures = true;
    commands.resetDevice.loadDeviceByMnemonic = true;
    commands.resetDevice.loadDeviceByXprv = true;

    //////////
    // INIT //
    //////////

    // do intial loading of features
    that.ready().initialize();

    return that;
	}

  /**
   * Returns entropy generated locally
   * @return {ByteBuffer}
   */
  function getLocalEntropy() {
    var randArr = new Uint8Array(32);
    /* global window */
    window.crypto.getRandomValues(randArr);
    return ByteBuffer.wrap(randArr);
  }

  /////////////////////////////////
  // MESSAGE RESPONSE DECORATORS //
  /////////////////////////////////

  /**
   * Checks that message response class is of the expected type
   * @param  {String}       msgClass  expected message class
   * @return {Function}
   */
  decorators.expect = function(msgClass) {
    return function(rxProtoMsg) {
      var rxProtoMsgClass = rxProtoMsg.$type.name;

      if(rxProtoMsgClass !== msgClass) {
          throw {
            name: 'Error',
            message: sprintf('Got %s, expected %s.', rxProtoMsgClass, msgClass)
          };
        }

      return rxProtoMsg;
    };
  };

  /**
   * Parses out the requested field and replaces the response with it
   * (this decorator should always be called very first in chaining)
   * @param  {String}       field  field to parse out of message response
   * @return {Function}
   */
  decorators.field = function(msgField) {
    return function(rxProtoMsg) {
      if(!rxProtoMsg.hasOwnProperty(msgField)) {
          throw {
            name: 'Error',
            message: sprintf('Message field "%s" not found in response.', msgField)
          };
        }

        return rxProtoMsg[msgField];
    };
  };

  ///////////////////////////
  // PUBLIC STATIC METHODS //
  ///////////////////////////

  /**
   * Creates only one instance of a client for a given connected device
   * @param  {Transport}  transport         transport object for connected device
   * @param  {ProtoBuf}   messagesProtoBuf  protocol buffer messages to be used for device
   * @return {Client}
   */
  module.exports.create = function (transport, messagesProtoBuf) {
    var transportDeviceId = transport.getDeviceId();

    if(!clients.hasOwnProperty(transportDeviceId)) {
      clients[transportDeviceId] = clientMaker(transport, messagesProtoBuf);
    }

    return clients[transportDeviceId];
  };

  /**
   * Factory that a client object based of device type
   * @param  {Transport} transport transport object for connected device
   * @return {Client}
   */
	module.exports.factory = function (transport) {
		var deviceInfo = transport.getDeviceInfo(),
      deviceType = null;

		// find matching vendor and product id and return
    // matched type
    for(deviceType in DEVICES) {
      if(DEVICES[deviceType].vendorId === deviceInfo.vendorId &&
        DEVICES[deviceType].productId === deviceInfo.productId) {

        return clientTypes[deviceType].create(transport);
      }
    }
	};

  /**
   * Finds and returns a client for a given connected device using
   * the connected device's transport
   * @param  {Transport}  transport transport object for connected device
   * @return {Client}
   */
  module.exports.find = function (transport) {
    var transportDeviceId = transport.getDeviceId();

    return clients[transportDeviceId];
  };

  /**
   * Removes a client for a given connected device using
   * the connected device's transport
   * @param  {Transport}  transport transport object for connected device
   */
  module.exports.remove = function (transport) {
    var transportDeviceId = transport.getDeviceId();

    delete clients[transportDeviceId];
  };
  
})();