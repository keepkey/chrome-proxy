var _ = require('lodash');
var dbPromise = require('./dbPromise.js');
var EventEmitter2 = require('eventemitter2').EventEmitter2;
var bitcore = require('bitcore');
var featuresService = require('./featuresService.js');

const NODES_STORE_NAME = 'nodes';

var eventEmitter = new EventEmitter2();

var walletNodes = {
  nodes: [],
  addListener: eventEmitter.addListener.bind(eventEmitter)
};

var transactionService;

var emitChangeEvent = function () {
  eventEmitter.emit('changed', walletNodes.nodes);
};

var saveNode = function (match) {
  dbPromise.then(function (db) {
    var store = db
      .transaction(NODES_STORE_NAME, 'readwrite')
      .objectStore(NODES_STORE_NAME);
    var updateRequest = store.put(match);
    updateRequest.onsuccess = function(event) {
      match.id = event.target.result;
    };

  });

  emitChangeEvent();
};

walletNodes.findNodeByPublicKey = function (publicKeyObject) {
  // NOTE: This only works because the node depth is always 3 and the
  // 2 nodes above it are always M/44'/0'. If this changes, this function
  // will break.

  return _.filter(walletNodes.nodes, function (it) {
    var childNum = it.nodePath[it.nodePath.length - 1];
    var level = it.nodePath.length;
    return childNum === publicKeyObject.node.child_num &&
      level === publicKeyObject.node.depth;
  });
};

walletNodes.registerPublicKey = function registerPublicKey(node, publicKeyObject) {
  if (node.xpub !== publicKeyObject.xpub) {
    node.xpub = publicKeyObject.xpub;
    node.chainCode = publicKeyObject.node.chain_code.toHex();
    node.fingerprint = publicKeyObject.node.fingerprint;
    node.publicKey = publicKeyObject.node.public_key.toHex();

    // This is for the case where the device has been reinitialized
    if (node.addresses) {
      node.addresses.length = 0;
    }

    populateAddresses('[0-1]/[0-19]', node);
    saveNode(node);
  }
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
  _.each(walletPools, function (pools, walletId) {
    _.each(pools, function (pool, poolIndex) {
      var ranges = [
        {start: poolIndex, end: poolIndex},
        {start: 0, end: pool + 20}
      ];

      var wallet = _.find(walletNodes.nodes, {hdNode: walletId});

      if (wallet) {
        var oldWallet = JSON.stringify(wallet);
        scanNodes(bitcore.HDPublicKey(wallet.xpub), '', wallet.addresses, ranges);
        if (oldWallet !== JSON.stringify(wallet)) {
          saveNode(wallet);
        }
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

function addDeviceIdToNodesWithoutIt() {
  var promise = featuresService.getPromise();

  _.each(walletNodes.nodes, function (it) {
    if (!it.deviceId) {
      promise
        .then(function (features) {
          //TODO Use the public key or something that changes with the key.
          it.deviceId = features.label;
          saveNode(it);
        });
    }
  });

  return promise;
}

var nodesResolved = false;

var addDefaultWalletNodes = function (db) {
  var promise = featuresService.getPromise();

  var walletNodeObjectStore = db
    .transaction(NODES_STORE_NAME, "readwrite")
    .objectStore(NODES_STORE_NAME);

  promise.then(function (features) {
    var defaultWallet = {
      hdNode: "m/44'/0'/0'",
      name: "My Wallet",
      nodePath: [2147483692, 2147483648, 2147483648],
      deviceId: features.label
    };
    var addDefaultWalletRequest = walletNodeObjectStore.add(defaultWallet);
    addDefaultWalletRequest.onsuccess = function(event) {
      defaultWallet.id = event.target.result;
    };
    walletNodes.nodes.push(defaultWallet);

    var testWallet = {
      hdNode: "m/44'/0'/1'",
      name: "Retirement Savings",
      nodePath: [2147483692, 2147483648, 2147483649],
      deviceId: features.label
    };
    var addTestWalletRequest = walletNodeObjectStore.add(testWallet);
    addTestWalletRequest.onsuccess = function(event) {
      testWallet.id = event.target.result;
    };
    walletNodes.nodes.push(testWallet);
  });
  return promise;
};

var loadValuesFromDatabase = function () {
  nodesResolved = false;

  return featuresService.getPromise()
    .then(function (features) {
      return new Promise(function (resolve, reject) {
        return dbPromise
          .then(function (db) {
            if (!features.initialized) {
              nodesResolved = true;
              reject('Device not initialized');
            } else {
              walletNodes.nodes.length = 0;

              var store = db
                .transaction(NODES_STORE_NAME, 'readonly')
                .objectStore(NODES_STORE_NAME);

              store.openCursor().onsuccess = function (event) {
                var cursor = event.target.result;
                if (cursor) {
                  if (!cursor.value.deviceId || cursor.value.deviceId === features.label) {
                    walletNodes.nodes.push(cursor.value);
                  }
                  cursor.continue();
                }
                else {
                  addDeviceIdToNodesWithoutIt()
                    .then(function () {
                      if (walletNodes.nodes.length === 0) {
                        return addDefaultWalletNodes(db);
                      }
                    })
                    .then(function () {
                      emitChangeEvent();
                      nodesResolved = true;
                      resolve(walletNodes.nodes);
                    });
                }
              };
            }
          });
      });
    })
    .catch(function (msg) {
      console.log('Rejected promise caught:', msg);
    });
};

walletNodes.nodesPromise = loadValuesFromDatabase();

walletNodes.reloadData = function () {
  if (nodesResolved) {
    walletNodes.nodesPromise = loadValuesFromDatabase();
  }
};

walletNodes.clear = function() {
  walletNodes.nodes.length = 0;
  emitChangeEvent();
};

module.exports = walletNodes;