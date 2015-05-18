//client._setDeviceInUse = function (status) {
//    return new Promise(function (resolve) {
//        if (status) {
//            assert(!deviceInUse);
//        }
//
//        deviceInUse = status;
//        resolve(deviceInUse);
//    });
//};
//
//client._getDecorators = function () {
//    return decorators;
//};
//
//client.getDeviceId = function () {
//    return featuresService.getPromise()
//        .then(function (features) {
//            return features.device_id;
//        });
//};
//
//client.getProtoBuf = function () {
//    return client.protoBuf;
//};
//
//client.call = function (txProtoMsg) {
//    return client.txAndRxTransport(txProtoMsg)
//        .then(function (rxProtoMsg) {
//            console.log('rxProtoMsg:', rxProtoMsg);
//            var handler = rxProtoMsg.$type.name;
//
//            console.log('handler:', handler);
//            if (client.hasOwnProperty('on' + handler)) {
//                return client['on' + handler](rxProtoMsg)
//                    .then(function (handlerTxProtoMsg) {
//                        return client.call(handlerTxProtoMsg);
//                    });
//            } else {
//                return rxProtoMsg;
//            }
//        })
//        .catch(function () {
//            console.error('failure', arguments);
//        });
//};
//
//client.txAndRxTransport = function (txProtoMsg) {
//    return client.writeToDevice(txProtoMsg)
//        .then(function () {
//            return transport.read();
//        });
//};
//
//client.cancel = function () {
//    return client.writeToDevice(new client.protoBuf.Cancel())
//        .then(decorators.deviceReady);
//};
//
//client.initialize = function () {
//    return client._setDeviceInUse(true)
//        .then(client.writeToDevice(new client.protoBuf.Initialize()))
//        .then(decorators.deviceReady)
//        .then(featuresService.getPromise);
//};
//
//client.getPublicNode = function (address_n) {
//    return client._setDeviceInUse(true)
//        .then(client.call.bind(client, new client.protoBuf.GetPublicKey(convertPrime(address_n))))
//        .then(decorators.deviceReady)
//        .then(decorators.expect('PublicKey'));
//};
//
//client.getAddress = function (args) {
//    args = args || {};
//    args.address_n = args.address_n || [];
//    args.coin_name = args.coin_name || null;
//    args.show_display = args.show_display || null;
//    args.multisig = args.multisig || null;
//
//    return client._setDeviceInUse(true)
//        .then(client.call.bind(client, new client.protoBuf.GetAddress(
//            args.address_n, args.coin_name, args.show_display, args.multisig
//        )))
//        .then(decorators.deviceReady)
//        .then(decorators.expect('Address'))
//        .then(decorators.field('address'));
//};
//
//client.getEntropy = function (size) {
//    return client.call(new client.protoBuf.GetEntropy(size))
//        .then(decorators.expect('Entropy'))
//        .then(decorators.field('entropy'));
//};
//
//client.ping = function (args) {
//    args.message = args.message || '';
//    args.button_protection = args.button_protection || false;
//    args.pin_protection = args.pin_protection || false;
//    args.passphrase_protection = args.passphrase_protection || false;
//
//    return client._setDeviceInUse(true)
//        .then(client.call.bind(client, new client.protoBuf.Ping(
//            args.message, args.button_protection, args.pin_protection, args.passphrase_protection
//        )))
//        .then(decorators.deviceReady)
//        .then(decorators.expect('Success'))
//        .then(decorators.field('message'));
//};
//
//client.applySettings = function (args) {
//    args.language = args.language || null;
//    args.label = args.label || null;
//    args.use_passphrase = args.use_passphrase || null;
//
//    return client.call(new client.protoBuf.ApplySettings(
//        args.language, args.label, args.use_passphrase
//    ))
//        .then(decorators.expect('Success'))
//        .then(decorators.field('message'));
//};
//
//client.clearSession = function () {
//    return client.call(new client.protoBuf.ClearSession())
//        .then(decorators.expect('Success'))
//        .then(decorators.field('message'));
//};
//
//client.changePin = function (remove) {
//    return client._setDeviceInUse(true)
//        .then(client.call.bind(client, new client.protoBuf.ChangePin(remove)))
//        .then(decorators.deviceReady, decorators.deviceReady)
//        .then(decorators.expect('Success'))
//        .then(decorators.field('message'))
//        .then(decorators.refreshFeatures);
//};
//
//client.signMessage = function (args) {
//    args.address_n = args.address_n || [];
//    args.message = args.message || '';
//    args.coin_name = args.coin_name || null;
//
//    return client.call(new client.protoBuf.SignMessage(
//        convertPrime(args.address_n), ByteBuffer.wrap(args.message.normalize('NFC')), args.coin_name
//    ))
//        .then(decorators.expect('MessageSignature'));
//};
//
//client.verifyMessage = function (args) {
//    var messageBB = null;
//
//    args.address = args.address || null;
//    args.signature = args.signature || null;
//    args.message = args.message || null;
//
//    if (args.message !== null) {
//        messageBB = ByteBuffer.wrap(args.message.normalize('NFC'));
//    }
//
//    return client.call(new client.protoBuf.VerifyMessage(
//        args.address, args.signature, messageBB
//    ))
//        .then(function (rxProtoMsg) {
//            if (rxProtoMsg.$type.name === 'Success') {
//                return true;
//            } else {
//                return false;
//            }
//        });
//
//};
//
//client.encryptMessage = function (args) {
//    args.pubkey = args.pubkey || null;
//    args.message = args.message || null;
//    args.display_only = args.display_only || null;
//    args.address_n = args.address_n || [];
//    args.coin_name = args.coin_name || null;
//
//    return client.call(new client.protoBuf.EncryptMessage(
//        args.pubkey, ByteBuffer.wrap(args.message.normalize('NFC')), args.display_only,
//        convertPrime(args.address_n), args.coin_name
//    ))
//        .then(decorators.expect('EncryptedMessage'));
//};
//
//client.decryptMessage = function (args) {
//    args.address_n = args.address_n || [];
//    args.nonce = args.nonce || null;
//    args.message = args.message || null;
//    args.hmac = args.hmac || null;
//
//    return client.call(new client.protoBuf.DecryptMessage(
//        convertPrime(args.address_n), args.nonce, args.message, args.hmac
//    ))
//        .then(decorators.expect('DecryptedMessage'));
//};
//
//client.encryptKeyValue = function (args) {
//    args.address_n = args.address_n || [];
//    args.key = args.key || null;
//    args.value = args.value || null;
//    args.ask_on_encrypt = args.ask_on_encrypt || true;
//
//    return client.call(new client.protoBuf.CipherKeyValue(
//        convertPrime(args.address_n), args.key, args.value, true, args.ask_on_encrypt, true
//    ))
//        .then(decorators.expect('CipheredKeyValue'))
//        .then(decorators.field('value'));
//};
//
//client.decryptKeyValue = function (args) {
//    args.address_n = args.address_n || [];
//    args.key = args.key || null;
//    args.value = args.value || null;
//    args.ask_on_decrypt = args.ask_on_decrypt || true;
//
//    return client.call(new client.protoBuf.CipherKeyValue(
//        convertPrime(args.address_n), args.key, args.value, false, true, args.ask_on_decrypt
//    ))
//        .then(decorators.expect('CipheredKeyValue'))
//        .then(decorators.field('value'));
//};
//
//client.estimateTxSize = function (args) {
//    args.outputs_count = args.outputs_count || 0;
//    args.inputs_count = args.inputs_count || 0;
//    args.coin_name = args.coin_name || null;
//
//    return client.call(new client.protoBuf.EstimateTxSize(args.outputs_count, args.inputs_count, args.coin_name))
//        .then(decorators.expect('TxSize'))
//        .then(decorators.field('tx_size'));
//};
//
//client.loadDeviceByMnemonic = function (args) {
//    args.mnemonic = args.mnemonic || null;
//    args.pin = args.pin || null;
//    args.passphrase_protection = args.passphrase_protection || null;
//    args.language = args.language || null;
//    args.label = args.label || null;
//    args.skip_checksum = args.skip_checksum || null;
//
//    return client.call(new client.protoBuf.LoadDevice(
//        args.mnemonic.normalize('NFC'), null, args.pin, args.passphrase_protection,
//        args.language, args.label, args.skip_checksum
//    ))
//        .then(decorators.expect('Success'))
//        .then(decorators.field('message'));
//};
//
//client.loadDeviceByXprv = function (args) {
//    var hdNode = null;
//
//    args.node = args.node || null;
//    args.pin = args.pin || null;
//    args.passphrase_protection = args.passphrase_protection || null;
//    args.language = args.language || null;
//    args.label = args.label || null;
//
//    // copy hdnode information into protocol buffer object
//    hdNode = new client.protoBuf.HDNodeType();
//    hdNode.depth = args.node.depth;
//    hdNode.fingerprint = args.node.parentFingerprint;
//    hdNode.child_num = args.node.index;
//    hdNode.chain_code = args.node.chainCode;
//    hdNode.private_key = args.node.privKey.d.toBuffer();
//
//    return client.call(new client.protoBuf.LoadDevice(
//        null, hdNode, args.pin, args.passphrase_protection, args.language, args.label, null
//    ))
//        .then(decorators.expect('Success'))
//        .then(decorators.field('message'));
//};
//
//decorators.expect = function (msgClass) {
//    return function (rxProtoMsg) {
//        var rxProtoMsgClass = rxProtoMsg.$type.name;
//
//        if (rxProtoMsgClass !== msgClass) {
//            throw {
//                name: 'Error',
//                message: sprintf('Got %s, expected %s.', rxProtoMsgClass, msgClass)
//            };
//        }
//
//        return rxProtoMsg;
//    };
//};
//
//decorators.field = function (msgField) {
//    return function (rxProtoMsg) {
//        if (!rxProtoMsg.hasOwnProperty(msgField)) {
//            throw {
//                name: 'Error',
//                message: sprintf('Message field "%s" not found in response.', msgField)
//            };
//        }
//
//        return rxProtoMsg[msgField];
//    };
//};
//
//decorators.deviceReady = function (rxProtoMsg) {
//    client._setDeviceInUse(false);
//    return rxProtoMsg;
//};
//
//decorators.refreshFeatures = function (rxProtoMsg) {
//    client.initialize();
//    return rxProtoMsg;
//};
//
