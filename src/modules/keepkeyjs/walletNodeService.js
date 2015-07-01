var _ = require('lodash');
var dbPromise = require('./dbPromise.js');
var EventEmitter2 = require('eventemitter2').EventEmitter2;

const NODES_STORE_NAME = 'nodes';

var eventEmitter = new EventEmitter2();

var walletNodes = {
    nodes: [],
    addListener: eventEmitter.addListener.bind(eventEmitter),
    registerPublicKey: function registerPublicKey(publicKeyObject) {
        var oldNodes = JSON.parse(JSON.stringify(walletNodes.nodes));

        var matches = _.filter(walletNodes.nodes, function(it) {
            var childNum = it.nodePath[it.nodePath.length - 1];
            var level = it.nodePath.length;
            return childNum === publicKeyObject.node.child_num &&
                level === publicKeyObject.node.depth;
        });

        if (matches.length !== 1) {
            console.error('error while matching public key to a node');
            return;
        }

        var match = matches[0];

        match.xpub = publicKeyObject.xpub;
        match.chainCode = publicKeyObject.node.chain_code.toHex();
        match.fingerprint = publicKeyObject.node.fingerprint;
        match.publicKey = publicKeyObject.node.public_key.toHex();

        dbPromise.then(function(db) {
            var store = db
                .transaction(NODES_STORE_NAME, 'readwrite')
                .objectStore(NODES_STORE_NAME);

            store.put(match);
        });

        eventEmitter.emit('changed', walletNodes.nodes, oldNodes);
    }
};

dbPromise
    .then(function (db) {
        return new Promise(function (resolve) {
            var store = db
                .transaction(NODES_STORE_NAME, 'readonly')
                .objectStore(NODES_STORE_NAME);

            var oldNodes = JSON.parse(JSON.stringify(walletNodes.nodes));

            store.openCursor().onsuccess = function (event) {
                var cursor = event.target.result;
                if (cursor) {
                    walletNodes.nodes.push(cursor.value);
                    cursor.continue();
                }
                else {
                    eventEmitter.emit('changed', walletNodes.nodes, oldNodes);
                    resolve(walletNodes.nodes);
                }
            };
        });
    });

module.exports = walletNodes;