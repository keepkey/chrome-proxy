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

    var client = require('../client.js'),
        protoBuf = require('../../../../tmp/keepkey/messages.js'),
        assert = require('assert');

    module.exports.getProtoBuf = function () {
        return protoBuf;
    };

    module.exports.create = function (transport) {

        var that = client.create(transport, protoBuf);
        var superRecoveryDevice = that.recoveryDevice;
        var decorators = that._getDecorators();

        that.getDeviceType = function () {
            return client.KEEPKEY;
        };

        that.recoveryDevice = function (args) {
            args = args || {};
            args.word_count = args.word_count || null;
            args.passphrase_protection = args.passphrase_protection || null;
            args.pin_protection = args.pin_protection || null;
            args.language = args.language || null;
            args.label = args.label || null;
            args.enforce_wordlist = args.enforce_wordlist || true;
            args.use_character_cipher = args.use_character_cipher || null;

            if (!args.use_character_cipher) {

                return superRecoveryDevice(args);

            } else {

                return that.getFeatures()
                    .then(function (features) {
                        assert(features.initialized === false);
                    })
                    .then(that._setDeviceInUse.bind(this, true))
                    .then(that.call.bind(this, new protoBuf.RecoveryDevice(
                        args.word_count, args.passphrase_protection, args.pin_protection,
                        args.language, args.label, args.enforce_wordlist, args.use_character_cipher
                    )))
                    .then(decorators.deviceReady, decorators.deviceReady)
                    .then(function (resp) {
                        console.dir(resp);
                    });
            }
        };

        return that;
    };
})();