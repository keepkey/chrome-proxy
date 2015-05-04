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
        protoBuf = require('../../../../tmp/keepkey/messages.js');

    module.exports.getProtoBuf = function () {
        return protoBuf;
    };

    module.exports.create = function (transport) {

        var that = client.create(transport, protoBuf);  // create parent client

        that.getDeviceType = function () {
            return client.TREZOR;
        };

        return that;
    };

})();