var _ = require('lodash');
var EventEmitter2 = require('eventemitter2').EventEmitter2;
var featuresService = require('../featuresService.js');
var blockcypher = require('../blockchainApis/blockcypher-wallet.js');

var eventEmitter = new EventEmitter2();
var nodes = [{
  hdNode: "m/44'/0'/0'",
  nodePath: [2147483692, 2147483648, 2147483648],
  wallet: {}
}];

var walletServicePromise = featuresService.getPromise()
  .then(function (features) {
    var promise = Promise.resolve();
    _.each(nodes, function (node) {
      node.deviceId = features.device_id;
      promise = promise.then(function () {
        return blockcypher.getWallet(node.deviceId);
      })
        .then(function (data) {
          _.merge(node.wallet, data);
          return node;
        });
      // TODO Handle errors from blockcypher
      //.catch(function(error) {
      //  alert('unexpected error calling blockchypher API:', error);
      //});
    });
    return promise
      .then(function () {
        return nodes;
      });
  });

function reloadBalances() {
  var promise = walletServicePromise;
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
  return walletServicePromise
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

      //eventEmitter.emit('changed', nodes);
      return nodes;
    });
}

function registerPublicKey(publicKeyObject) {
  return walletServicePromise
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
    });
}

function clear() {
  nodes.length = 0;
}

function findNodeById(id) {
  return nodes[0];
}

var getUnusedAddressNodeFactory = function (index) {
  return function getUnusedAddressNode() {
    var node = nodes[0];

    return blockcypher.getUnusedAddressNode(node, index);
  };
};

module.exports = {
  nodes: nodes,
  nodesPromise: walletServicePromise,
  getUnusedExternalAddressNode: getUnusedAddressNodeFactory(0),
  getUnusedChangeAddressNode: getUnusedAddressNodeFactory(1),
  clear: clear,
  //reloadData: reloadData,
  findNodeById: findNodeById,
  registerPublicKey: registerPublicKey,
  addListener: eventEmitter.addListener.bind(eventEmitter),
  //updateNodes: updateNodes
  loadUnspentTransactionSummaries: loadUnspentTransactionSummaries,
  reloadBalances: reloadBalances
};