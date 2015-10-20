var _ = require('lodash');
var EventEmitter2 = require('eventemitter2').EventEmitter2;
var featuresService = require('../featuresService.js');
var blockcypher = require('../blockchainApis/blockcypher-wallet.js');
var config = require('../../../../dist/config.json');

var eventEmitter = new EventEmitter2();
var nodes = _.cloneDeep(config.defaultAccounts);

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
  walletServicePromise = undefined;
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

function getWalletAddressNode(node, address) {
  var chains = node.wallet && node.wallet.chains;
  var addressNode = _.reduce(chains, function (nodePath, chain) {
    if (!nodePath) {
      var addressNode = _.find(chain.chain_addresses, {address: address});
      nodePath = addressNode;
    }
    return nodePath;
  }, undefined);
  return addressNode;
}

function getHdNodeForAddress(node, address) {
  var addressNode = getWalletAddressNode(node, address);
  console.assert(addressNode, 'Unable to find the node path for ' + address + ' in node. API data incorrect?', addressNode);
  return addressNode.path;
}

function changeDetectedInNodes(originalNodes) {
  return !_.isEqual(nodes, originalNodes, function (value, other, index) {
    if (index === 'confidence') {
      var delta = Math.abs(value - other);
      return delta < config.confidenceThreshholds.acceptableDelta;
    }
  });
}
function loadUnspentTransactionSummaries(nodeId) {
  var node;
  var originalNodes = _.clone(nodes, true);
  return getWalletServicePromise()
    .then(function () {
      node = nodes[0]; //_.find(nodes, { id: nodeId });
      return blockcypher.getUnspentTransactionSummaries(node.deviceId);
    })
    .then(function (data) {
      data.highConfidenceBalance = 0;
      data.lowConfidenceBalance = 0;

      _.each(data.txrefs, function (it) {
        if (!it.hdNode) {
          it.hdNode = getHdNodeForAddress(node, it.address);
        }
        if (!it.spent) {
          data.highConfidenceBalance += it.value;
        }
      });

      _.each(data.unconfirmed_txrefs, function (it) {
        if (!it.hdNode) {
          it.hdNode = getHdNodeForAddress(node, it.address);
        }
        if (it.value > 0 && it.confidence >= config.confidenceThreshholds.highConfidence) {
          data.highConfidenceBalance += it.value;
        } else {
          data.lowConfidenceBalance += it.value;
        }
      });

      if (node && node.wallet && node.wallet.chains && node.wallet.chains.length) {
        delete node.wallet.chains[0].firstUnused;
      }

      _.merge(node, data);

      if (changeDetectedInNodes(originalNodes)) {
        eventEmitter.emit('changed', nodes);
      }
      return node;
    })
    .then(getUnusedAddressNodeFactory(0))
    .catch(function () {
      return node;
    });
}

function registerPublicKey(publicKeyObject) {
  return getWalletServicePromise()
    .then(function () {
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
    .catch(function () {
      console.error('error registering a public key');
    });
}

function clear() {
  nodes.length = 0;
  Array.prototype.push.apply(nodes, _.cloneDeep(config.defaultAccounts));
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

function getTransactionHistory(walletNode) {
  var originalNodes;
  var node;

  function categorizeFragments(fragments, localAddresses) {
    var result = {
      local: [],
      foreign: []
    };

    _.each(fragments, function (fragment) {
      console.assert(fragment.addresses && fragment.addresses.length === 1,
        'A fragment should have one address associated with it');
      if (!fragment.addresses || !fragment.addresses.length ||
        localAddresses.indexOf(fragment.addresses[0]) === -1) {
        result.foreign.push(fragment);
      } else {
        result.local.push(fragment);
      }
    });
    return result;
  }

  return getWalletServicePromise()
    .then(function () {
      originalNodes = _.clone(nodes, true);
      node = nodes[0]; //_.find(nodes, { id: nodeId });
      return blockcypher.getTransactionHistory(node.deviceId);
    })
    .then(function (data) {
      var txHist = _.collect(data.txs, function (tx) {
        console.assert(tx.inputs.length, 'There must be inputs to a transction');
        var splitInputs = categorizeFragments(tx.inputs, data.wallet.addresses);
        console.assert(!splitInputs.local.length || !splitInputs.foreign.length,
          'Transaction inputs must be all local or all foreign');
        var localInputAmount = _.reduce(splitInputs.local, function (amount, input) {
          return amount + input.output_value;
        }, 0);

        console.assert(tx.outputs.length, 'There must be outputs to a transaction');
        var splitOutputs = categorizeFragments(tx.outputs, data.wallet.addresses);
        var localOutputAmount = _.reduce(splitOutputs.local, function (amount, output) {
          return amount + output.value;
        }, 0);

        var amountReceived = 0, amountSent = 0, fee = 0, addresses = [];

        if (localInputAmount === 0) {
          amountReceived = localOutputAmount;
          addresses = _.uniq(_.flatten(_.pluck(splitInputs.foreign, 'addresses')));
        } else {
          var inputAmount = _.reduce(tx.inputs, function (sum, input) {
            return sum + input.output_value;
          }, 0);
          var outputAmount = _.reduce(tx.outputs, function (sum, output) {
            return sum + output.value;
          }, 0);
          fee = inputAmount - outputAmount;
          amountSent = localInputAmount - localOutputAmount - fee;
          addresses = _.uniq(_.flatten(_.pluck(splitOutputs.foreign, 'addresses')));
        }

        if (addresses.length === 0) {
          addresses = ['<internal transfer>'];
        }

        return {
          date: tx.received,
          timestamp: new Date(tx.received),
          confidence: tx.confidence,
          amountReceived: amountReceived,
          amountSent: amountSent,
          fee: fee,
          addresses: addresses,
          pending: tx.confidence < config.confidenceThreshholds.highConfidence,
          link: blockcypher.getTransactionUrl(tx.hash)
        };
      });

      txHist.sort(function (tx, other) {
        return other.timestamp - tx.timestamp;
      });

      _.reduceRight(txHist, function (balance, tx) {
        tx.balance = balance + tx.amountReceived - tx.amountSent - tx.fee;
        return tx.balance;
      }, 0);

      _.merge(node, data, {txHist: txHist});

      if (changeDetectedInNodes(originalNodes)) {
        console.log('changed');
        eventEmitter.emit('changed', nodes);
      }
    });
}

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
  reloadBalances: reloadBalances,
  getTransactionHistory: getTransactionHistory
};