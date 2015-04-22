/* jshint devel: true */

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
    "use strict";

    var clientModule = require('./modules/keepkeyjs/client.js'),
        transportHid = require('./modules/keepkeyjs/transport_hid.js'),
        clientPool = [];

    /**
     * Creates a client when a device is connected
     * @param  {Transport}  transport   connected transport used to create new client
     */
    var handleDeviceConnected = function (transport) {
        var client = clientModule.factory(transport);
        clientPool.push(client);
        console.log("%s connected: %d", client.getDeviceType(), transport.getDeviceId());
    };

    /**
     * Finds a client by it's transport and removes it from client pool.
     * @param  {Transport}  transport   a disconnected transport to use to find client
     */
    var handleDeviceDisconnected = function (transport) {
        var disconnectedClient = clientModule.find(transport),
            i = 0,
            max = clientPool.length;

        for (; i < max; i += 1) {
            if (clientPool[i] === disconnectedClient) {
                clientPool.splice(i, 1);
            }
        }

        clientModule.remove(transport);

        console.log("%s Disconnected: %d", disconnectedClient.getDeviceType(), transport.getDeviceId());
    };

    transportHid.onDeviceConnected(handleDeviceConnected);
    transportHid.onDeviceDisconnected(handleDeviceDisconnected);
    transportHid.startListener();

})();