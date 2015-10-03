var _ = require('lodash');
var EventEmitter2 = require('eventemitter2').EventEmitter2;
var featuresService = require('../featuresService.js');
var blockcypher = require('../blockchainApis/blockcypher-wallet.js');

const DEFAULT_NODES = [{
  hdNode: "m/44'/0'/0'",
  nodePath: [2147483692, 2147483648, 2147483648],
  wallet: {}
}];

var eventEmitter = new EventEmitter2();
var nodes = _.cloneDeep(DEFAULT_NODES);

var walletServicePromise = getWalletServicePromise();

function getWalletServicePromise() {
  if (!walletServicePromise) {
    walletServicePromise = new Promise(function (resolve, reject) {

      featuresService.getPromise()
        .then(function (features) {
          if (!features.device_id || !features.initialized) {
            walletServicePromise = undefined;
            reject('device not initialized');
          } else {
            var promises = [];
            _.each(nodes, function (node) {
              node.deviceId = 'X' + features.device_id.substring(0, 23);
              promises.push(
                blockcypher.getWallet(node.deviceId)
                  .then(function (data) {
                    _.merge(node.wallet, data);
                    return node;
                  })
              );
            });
            return Promise.all(promises)
              .then(function () {
                resolve(nodes);
              })
              .catch(function (status) {
                walletServicePromise = undefined;
                resolve(nodes);
              });
          }
        });
    });
  }
  return walletServicePromise;
}

function reloadBalances() {
  return getWalletServicePromise()
    .then(function () {
      var promise = Promise.resolve();
      _.each(nodes, function (node) {
        promise = promise
          .then(function () {
            return loadUnspentTransactionSummaries(node.deviceId);
          })
          .then(function (data) {
            _.merge(node, data);
            return node;
          });
      });
      return promise
        .then(function () {
          eventEmitter.emit('changed', nodes);
          return nodes;
        });
    });
}

function getHdNodeForAddress(node, address) {
  var chains = node.wallet && node.wallet.chains;
  var path = _.reduce(chains, function (nodePath, chain) {
    if (!nodePath) {
      var addressNode = _.find(chain.chain_addresses, {address: address});
      nodePath = addressNode && addressNode.path;
    }
    return nodePath;
  }, undefined);

  return path;
}

function loadUnspentTransactionSummaries(nodeId) {
  var node;
  var originalNodes = _.clone(nodes, true);
  return getWalletServicePromise()
    .then(function (nodes) {
      node = nodes[0]; //_.find(nodes, { id: nodeId });
      return blockcypher.getUnspentTransactionSummaries(node.deviceId);
    })
    .then(function (data) {
      _.each(data.txrefs, function (it) {
        if (!it.hdNode) {
          it.hdNode = getHdNodeForAddress(node, it.address);
        }
      });

      _.each(data.unconfirmed_txrefs, function (it) {
        if (!it.hdNode) {
          it.hdNode = getHdNodeForAddress(node, it.address);
        }
      });

      _.merge(node, data);

      if (!_.isEqual(nodes, originalNodes)) {
        eventEmitter.emit('changed', nodes);
      }
      return node;
    })
    .catch(function() {
      return node;
    });
}

function registerPublicKey(publicKeyObject) {
  return getWalletServicePromise()
    .then(function (nodes) {
      var node = nodes[0];
      if (node.wallet.xpub !== publicKeyObject.xpub) {
        node.wallet.xpub = publicKeyObject.xpub;
        return blockcypher.getWallet(node.deviceId, node.wallet.xpub)
          .then(function (data) {
            _.merge(node.wallet, data);
            return loadUnspentTransactionSummaries(node.deviceId);
          })
          .then(function (data) {
            eventEmitter.emit('changed', nodes);
            return nodes;
          });
      } else {
        return nodes;
      }
    })
    .catch(function() {
      console.error('error registering a public key');
    });
}

function clear() {
  nodes.length = 0;
  Array.prototype.push.apply(nodes, _.cloneDeep(DEFAULT_NODES));
  walletServicePromise = undefined;
}

function findNodeById(id) {
  return nodes[0];
}

var getUnusedAddressNodeFactory = function (index) {
  return function getUnusedAddressNode() {
    var node = nodes[0];

    return blockcypher.getUnusedAddressNode(node.wallet, index);
  };
};

module.exports = {
  nodes: nodes,
  getNodesPromise: getWalletServicePromise,
  getUnusedExternalAddressNode: getUnusedAddressNodeFactory(0),
  getUnusedChangeAddressNode: getUnusedAddressNodeFactory(1),
  clear: clear,
  findNodeById: findNodeById,
  registerPublicKey: registerPublicKey,
  addListener: eventEmitter.addListener.bind(eventEmitter),
  loadUnspentTransactionSummaries: loadUnspentTransactionSummaries,
  reloadBalances: reloadBalances
};