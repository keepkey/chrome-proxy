var _ = require('lodash');
var dbPromise = require('./dbPromise.js');
var EventEmitter2 = require('eventemitter2').EventEmitter2;
var bitcore = require('bitcore');

const NODES_STORE_NAME = 'nodes';

var eventEmitter = new EventEmitter2();

var walletNodes = {
    nodes: [],
    addListener: eventEmitter.addListener.bind(eventEmitter)
};

var transactionService;

var emitChangeEvent = _.throttle(function() {
    eventEmitter.emit('changed', walletNodes.node);
}, 100, {trailing: true});

var saveNode = function(match) {
    dbPromise.then(function (db) {
        var store = db
            .transaction(NODES_STORE_NAME, 'readwrite')
            .objectStore(NODES_STORE_NAME);
        store.put(match);
    });

    emitChangeEvent();
};

walletNodes.registerPublicKey = function registerPublicKey(publicKeyObject) {
    var matches = _.filter(walletNodes.nodes, function (it) {
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

    populateAddresses('[0-1]/[0-19]', match);
    saveNode(match);
};

//TODO Move the address functionality to an AddressService

walletNodes.getAddressList = function getAddressList() {
    var addressList = [];
    _.each(walletNodes.nodes, function (node) {
        addressList.push(_.flattenDeep(node.addresses));
    });
    return _.collect(_.flattenDeep(addressList), 'address');
};

walletNodes.addressNodePath = function addressNodePath(address) {
    var path = '';
    _.find(walletNodes.nodes, function (node) {
        var addressData = _.find(_.flattenDeep(node.addresses), {
            address: address
        });
        if (addressData) {
            path = [node.hdNode, addressData.path].join('/');
        }
        return addressData;
    });
    return path;
};

walletNodes.firstUnusedAddressNode = function firstUnusedAddress(addressArray) {
    var unusedAddressNode = _.find(addressArray, function (it) {
        return transactionService.addressIsUnused(it.address);
    });
    var nodes = unusedAddressNode.path.split('/');
    nodes.forEach(function (it, idx, arr) {
        arr[idx] = parseInt(it);
    });
    return nodes;
};

function updateAddressPools() {
    var addressPools = _.groupBy(transactionService.countTransactionsByNode(), function (count, nodeId) {
        return nodeId.split('/').slice(0, -1).join('/');
    });
    var maxIndexes = _.reduce(addressPools, function (result, pool, poolId) {
        var max = Math.max.apply(this, _.keys(pool));
        result[poolId] = max;
        return result;
    }, {});
    var walletPools = _.groupBy(maxIndexes, function (max, poolId) {
        return poolId.split('/').slice(0, -1).join('/');
    });
    var ranges = _.each(walletPools, function (pools, walletId) {
        _.each(pools, function (pool, poolIndex) {
            var ranges = [
                {start: poolIndex, end: poolIndex},
                {start: 0, end: pool + 20}
            ];

            var wallet = _.find(walletNodes.nodes, {hdNode: walletId});

            var oldWallet = JSON.stringify(wallet);
            scanNodes(bitcore.HDPublicKey(wallet.xpub), '', wallet.addresses, ranges);
            if (oldWallet !== JSON.stringify(wallet)) {
                saveNode(wallet);
            }
        });
    }, []);
}

walletNodes.registerTransactionService = function (service) {
    transactionService = service;
    transactionService.addListener('changed', updateAddressPools);
};

function populateAddresses(range, node) {
    if (!node.addresses) {
        node.addresses = [];
    }
    scanNodes(bitcore.HDPublicKey(node.xpub), '', node.addresses, parseRange(range));
}


function scanNodes(publicKey, path, addresses, ranges) {
    for (var i = ranges[0].start; i <= ranges[0].end; i++) {
        var derivedKey = publicKey.derive(i);
        var derivedPath = !!path ? [path, i].join('/') : '' + i;
        if (ranges.length > 1) {
            addresses[i] = scanNodes(derivedKey, derivedPath, addresses[i] || [], ranges.slice(1));
        }
        else {
            if (!addresses[i]) {
                addresses[i] = {
                    xpub: derivedKey.publicKey.toString(),
                    address: derivedKey.publicKey.toAddress().toString(),
                    path: derivedPath
                };
            }
        }
    }
    return addresses;
}


function parseRange(range) {
    var levels = range.split('/');
    var parsed = [];

    for (var i = 0; i < levels.length; i++) {
        var level = levels[i];
        var tokens = level.match(/\[([0-9]+)-([0-9]+)\]/);
        if (tokens) {
            parsed.push({
                start: parseInt(tokens[1]),
                end: parseInt(tokens[2])
            });
        } else {
            throw 'unable to parse range: ' + level;
        }
    }
    return parsed;
}

walletNodes.nodesPromise = dbPromise.then(function (db) {
    return new Promise(function (resolve) {
        var store = db
            .transaction(NODES_STORE_NAME, 'readonly')
            .objectStore(NODES_STORE_NAME);

        store.openCursor().onsuccess = function (event) {
            var cursor = event.target.result;
            if (cursor) {
                walletNodes.nodes.push(cursor.value);
                cursor.continue();
            }
            else {
                emitChangeEvent();
                resolve(walletNodes.nodes);
            }
        };
    });
});

module.exports = walletNodes;