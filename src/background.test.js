/* global client */
/* jshint devel: true */
///////////
// TESTS //
///////////
(function () {
    "use strict";

    var bitcoin = require('bitcoinjs-lib');
    var ByteBuffer = require('bytebuffer');

    /**
     * Logs a command, prefixing it with the passed field name
     * @param  {String} fieldName  field name to prefix value in log
     * @return {Function}
     */
    var log = function(fieldName) {
        return function(value) {
            console.log("%s: %s", fieldName, value);
        };
    };

    /**
     * Creates a function that logs a message
     * @param  {String} format  format of the message to log
     * @return {Function}
     */
    var logMessageFactory = function(format) {
        format = format || "Received: %s";

        return function(message) {
            console.log(format, message);
        };
    };

    /**
     * Logs entropy and formmating the value in hex
     * @param  {ByteBuffer} entropy  entropy to log
     */
    var logEntropy = function(entropy) {
        console.log("Entropy: %s", entropy.toString('hex'));
    };

    /**
     * Logs a protocol buffer
     * @param  {ProtoBuf} protoBuf  protocol buffer to log
     */
    var logProto = function(protoBuf) {
        console.dir(protoBuf);
        return protoBuf;
    };

    var testing = {};

    testing.GetFeatures = function (client) {
        client.getFeatures()
            .then(function (features) {
                return JSON.stringify(features);
            })
            .then(logMessageFactory("Features"));
    };

    testing.GetDeviceId = function (client) {
        client.getDeviceId()
            .then(logMessageFactory("Device ID: %s"));
    };

    testing.GetEntropy = function (client) {
        client.ready().getEntropy(64)
            .then(logEntropy);
    };

    testing.Ping = function (client) {
        client.ready().ping({message: 'This is a testing. ping!', button_protection: true})
            .then(logMessageFactory("Ping Response: %s"));
    };

    testing.WipeDevice = function (client) {
        client.ready().wipeDevice()
            .then(logMessageFactory());
    };

    testing.ResetDevice = function (client) {
        client.ready().resetDevice({strength: 128})
            .then(logMessageFactory());
    };

    testing.GetAddress = function (client) {
        var i = 0;

        for (; i < 10; i += 1) {
            client.ready().getAddress({address_n: [i], coin_name: 'Bitcoin', show_display: false})
                .then(log('Address'));
        }

        client.ready().clearSession()
            .then(logMessageFactory());

        for (; i < 20; i += 1) {
            client.ready().getAddress({address_n: [i], coin_name: 'Bitcoin', show_display: false})
                .then(log('Address'));
        }
    };

    testing.ApplySettings = function (client) {
        client.ready().applySettings({label: "Test Label"})
            .then(logMessageFactory());
    };

    testing.SignVerifyMessage = function (client) {
        client.ready().signMessage({address_n: [1], message: 'this is the message to sign'})
            .then(logProto)
            .then(function (protoBuf) {
                return client.ready().verifyMessage(
                    {address: protoBuf.address, signature: protoBuf.signature, message: 'this is the message to sign'}
                );
            })
            .then(function (valid) {
                if (valid) {
                    console.log('Signed Message is valid');
                } else {
                    console.log('Signed Message is invalid');
                }
            });
    };

    testing.GetPublicNodeEncryptMessageDecryptMessage = function (client) {
        client.ready().getPublicNode([1])
            .then(logProto)
            .then(function (protoBuf) {
                return client.ready().encryptMessage({
                    pubkey: protoBuf.node.public_key, message: 'This is the message to encrypt', address_n: [1]
                });
            })
            .then(logProto)
            .then(function (protoBuf) {
                return client.ready().decryptMessage({
                    address_n: [1], nonce: protoBuf.nonce, message: protoBuf.message, hmac: protoBuf.hmac
                });
            })
            .then(logProto);
    };

    testing.EncryptKeyValue = function (client) {
        client.ready().encryptKeyValue({
            address_n: [1],
            key: 'thisiskey',
            value: ByteBuffer.fromUTF8('1111111111111111')
        })
            .then(function (value) {
                console.log('Encrypted Value: %s', value);
            });
    };

    testing.LoadDeviceByMnemonic = function (client) {
        client.ready().loadDeviceByMnemonic({mnemonic: 'knock hospital transfer wealth page apology cradle puppy remind episode solve hospital'})
            .then(logMessageFactory());
    };

    testing.LoadDeviceByXprv = function (client) {
        var hdNode = bitcoin.HDNode.fromBase58('xprv9s21ZrQH143K3wqna1KnwoSH3reKVVp68cAuJ4izQMMe7VvzBcFdnxYvtMifigMDynsTzCSiLvCt2ksKYrSY4m5z2AQc7g7vZL6uvdaSiBn');

        client.ready().loadDeviceByXprv({node: hdNode})
            .then(logMessageFactory());
    };

    testing.EstimateTxSize = function (client) {
        client.ready().estimateTxSize({outputs_count: 25, inputs_count: 10})
            .then(logMessageFactory());
    };

//testing.GetFeatures(client);
//testing.GetDeviceId(client);
// testing.GetEntropy(client);
// testing.Ping(client);
//testing.WipeDevice(client);
// testing.GetFeatures(client);
//testing.ResetDevice(client);
//testing.GetAddress(client);
// testing.ApplySettings(client);
// testing.SignVerifyMessage(client);
// testing.GetPublicNodeEncryptMessageDecryptMessage(client);
// testing.EncryptKeyValue(client);
// testing.GetFeatures(client);
// testing.WipeDevice(client);
// testing.LoadDeviceByMnemonic(client);
// testing.LoadDeviceByXprv(client);
//testing.EstimateTxSize(client);
})();
