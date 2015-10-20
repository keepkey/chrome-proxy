var _ = require('lodash');
var httpClient = require('../HttpClient.js');

const API_KEY = 'd9a5e85023faa87914a191f6a741a2c4';
const API_ROOT = 'https://api.blockcypher.com/v1/btc/main';
const SEND_RAW_TRANSACTION_PATH = 'txs/push';
const HD_WALLET_API_PATH = 'wallets/hd';
const ADDRESSES_PATH = 'addresses';
const DERIVE_ADDRESSES_PATH = 'addresses/derive';
const ADDRESS_API_PATH = 'addrs';
const WALLET_BALANCE_PATH = 'balance';
const FULL_TRANSACTIONS = 'full';
const TX_PATH = 'txs';
const API_TOKEN_PARAMETER = urlParameter('token', API_KEY);

function sendTransactionUri() {
  return [
    API_ROOT,
    SEND_RAW_TRANSACTION_PATH
  ].join('/');
}

function sendTransactionUrl() {
  return [
    sendTransactionUri(),
    API_TOKEN_PARAMETER
  ].join('?');
}

function urlParameter(name, value) {
  return [name, value].join('=');
}

function getWalletUrl(name) {
  return [
    [API_ROOT, HD_WALLET_API_PATH, name].join('/'),
    API_TOKEN_PARAMETER
  ].join('?');
}

function getTransactionsUrl(name, before, getHistory) {
  //https://api.blockcypher.com/v1/btc/main/addrs/{{name}}?token={{api-token}}&limit=200&unspentOnly=true
  var parameters = [
    API_TOKEN_PARAMETER,
    //urlParameter('omitWalletAddresses', true)
  ];

  var path = [API_ROOT, ADDRESS_API_PATH, name];

  if (before) {
    parameters.push(urlParameter('before', before));
  }

  if (!getHistory) {
    parameters.push(urlParameter('unspentOnly', 'true'));
  } else {
    path.push(FULL_TRANSACTIONS);
    parameters.push(urlParameter('limit', '50'));
  }

  return [
    path.join('/'),
    parameters.join('&')
  ].join('?');
}

function createWalletUrl() {
  return [
    [API_ROOT, HD_WALLET_API_PATH].join('/'),
    API_TOKEN_PARAMETER
  ].join('?');
}

function unusedAddressesUrl(name) {
  return [
    [API_ROOT, HD_WALLET_API_PATH, name, ADDRESSES_PATH].join('/'),
    [API_TOKEN_PARAMETER, urlParameter('used', 'false')].join('&')
  ].join('?');
}

function deriveAddressesUrl(name) {
  //https://api.blockcypher.com/v1/btc/main/wallets/hd/{{name}}/addresses/derive?token={{api-token}}
  return [
    [API_ROOT, HD_WALLET_API_PATH, name, DERIVE_ADDRESSES_PATH].join('/'),
    API_TOKEN_PARAMETER
  ].join('?');
}

function createWalletPayload(name, xpub) {
  return {
    "name": name,
    "extended_public_key": xpub,
    "subchain_indexes": [0, 1]
  };
}

function deriveAddressesPayload(index) {
  return {
    "count": 1,
    "subchain_index": index
  };
}


function deleteWallet(name) {
  return httpClient.delete(getWalletUrl(name));
}

function createWallet(name, xpub) {
  var promise;

  if (name && xpub) {
    var url = createWalletUrl();
    var payload = createWalletPayload(name, xpub);

    promise = httpClient.post(url, JSON.stringify(payload))
      .then(function (createdWallet) {
        return translateToLocalFormat(createdWallet);
      });
  } else {
    promise = Promise.reject('name and xpub must be specified');
  }

  return promise;
}

function getWallet(name, xpub) {
  var promise;

  if (name) {
    var url = getWalletUrl(name);
    promise = httpClient.get(url)
      .then(function (data) {
        if (xpub) {
          if (data.extended_public_key === xpub) {
            return translateToLocalFormat(data);
          } else {
            return deleteWallet(name)
              .then(function () {
                return createWallet(name, xpub);
              });
          }
        } else {
          return translateToLocalFormat(data);
        }
      })
      .catch(function (status) {
        if (status === 404 && xpub) {
          return createWallet(name, xpub);
        } else {
          return Promise.reject(status);
        }
      });
  } else {
    promise = Promise.reject('wallet name required');
  }

  return promise;
}

var getHistoryDecorator = {
  getTransactionsUrl: _.curryRight(getTransactionsUrl)(true),
  getTransactionCollections: function (wallet) {
    return [wallet.txs];
  },
  getTransactionLocator: function (transaction) {
    return {
      hash: transaction.hash
    };
  }
};

var getSummaryDecorator = {
  getTransactionsUrl: _.curryRight(getTransactionsUrl)(false),
  getTransactionCollections: function (wallet) {
    return [wallet.txrefs, wallet.unconfirmed_txrefs];
  },
  getTransactionLocator: function (transaction) {
    return {
      tx_hash: transaction.tx_hash,
      tx_input_n: transaction.tx_input_n,
      tx_output_n: transaction.tx_output_n
    };
  }
};


function getTransactions(name, decorator) {
  function selectResumeHeightFromList(uniqList) {
    // returns the second lowest to handle blocks with multiple transactions
    if (uniqList.length > 1) {
      return uniqList[1];
    } else {
      return uniqList[0];
    }
  }

  function getResumeHeight() {
    var allTransactions = _.flatten(arguments);
    var blockHeights = _.pluck(allTransactions, 'block_height');
    _.remove(blockHeights, function (item) {
      return item === -1;
    });
    blockHeights.sort();

    return selectResumeHeightFromList(_.uniq(blockHeights, true));
  }

  function getTransactionFromList(list, transaction) {
    return _.find(list, decorator.getTransactionLocator(transaction));
  }

  function isTransactionComplete(transaction) {
    return transaction.vin_sz > transaction.inputs.length ||
      transaction.vout_sz > transaction.outputs.length;
  }

  function getPartialTransactionUrl(hash, inputStartIndex, outputStartIndex) {
    return [
      [API_ROOT, TX_PATH, hash].join('/'),
      [
        API_TOKEN_PARAMETER,
        urlParameter('limit', '500'),
        urlParameter('instart', inputStartIndex),
        urlParameter('outstart', outputStartIndex)
      ].join('&')
    ].join('?');
  }

  function downloadLargeTransaction(transaction) {
    var startInputIndex = transaction.inputs.length;
    var startOutputIndex = transaction.outputs.length;
    return httpClient.get(getPartialTransactionUrl(transaction.hash, startInputIndex, startOutputIndex))
      .then(function (data) {
        Array.prototype.push.apply(transaction.inputs, data.inputs);
        Array.prototype.push.apply(transaction.outputs, data.outputs);
        if (isTransactionComplete(transaction)) {
          return downloadLargeTransaction(transaction);
        }
      });
  }

  function mergeNewTransactions(master, additions) {
    var promise = Promise.resolve();
    _.each(additions, function (transaction) {
      if (transaction.inputs.length === 1 && transaction.inputs[0].output_index === -1) {
        transaction.inputs[0].addresses = ['<new>'];
      }
      if (!getTransactionFromList(master, transaction)) {
        master.push(transaction);
      }

      if (isTransactionComplete(transaction)) {
        promise = promise.then(function () {
          return downloadLargeTransaction(transaction);
        });
      }
      promise = promise.then(function () {
        console.assert(transaction.vin_sz === transaction.inputs.length, 'vin_sz should match the number of inputs');
        console.assert(transaction.vout_sz === transaction.outputs.length, 'vout_sz should match the number of outputs');
      });
    });
    return promise;
  }

  function getMoreTransactions(resolve, wallet, before) {
    if (!wallet) {
      wallet = {};
    }
    return httpClient.get(decorator.getTransactionsUrl(name, before))
      .then(function (data) {
        if (!data.txrefs) {
          data.txrefs = [];
        }
        if (!data.unconfirmed_txrefs) {
          data.unconfirmed_txrefs = [];
        }
        if (!data.txs) {
          data.txs = [];
        }
        return data;
      })
      .then(function (data) {
        if (!wallet.txrefs && !wallet.unconfirmed_txrefs && !wallet.txs) {
          _.extend(wallet, data);
          return data;
        } else {
          return mergeNewTransactions(wallet.txrefs, data.txrefs)
            .then(function () {
              return mergeNewTransactions(wallet.unconfirmed_txrefs, data.unconfirmed_txrefs);
            })
            .then(function () {
              return mergeNewTransactions(wallet.txs, data.txs);
            })
            .then(function () {
              return data;
            });
        }
      })
      .then(function (data) {
        if (data.hasMore) {
          var resumeHeight = getResumeHeight.apply(this, decorator.getTransactionCollections(wallet));
          return getMoreTransactions(resolve, wallet, resumeHeight);
        } else {
          resolve(wallet);
        }
      });
  }

  function getFirstTransactionSummaries() {
    return new Promise(function (resolve, reject) {
      getMoreTransactions(resolve)
        .catch(function (status) {
          if (status === 404) {
            return reject(status);
          }
        });
    });
  }

  if (name) {
    return getFirstTransactionSummaries()
      .then(translateToLocalFormat);
  }
  else {
    return Promise.reject('wallet name required');
  }
}

function updateWallet(node, data) {
  _.merge(node, data, function (a, b, key, object, source) {
    if (key === 'chains') {
      if (!a) {
        a = object.chains = [];
      }
      return updateChainCollection(a, b);
    }
  });
}

function updateChainCollection(aList, bList) {
  _.each(bList, function (bObj) {
    var aObj = _.find(aList, {index: bObj.index});
    if (aObj) {
      updateChain(aObj, bObj);
    } else {
      aList.push(bObj);
    }
  });
  return aList;
}

function updateChain(aObj, bObj) {
  _.merge(aObj, bObj, function (aElement, bElement, key, object) {
    if (key === 'addresses') {
      if (!aElement) {
        aElement = object.addresses = [];
      }
      return updateAddressCollection(aElement, bElement);
    }
  });
}

function updateAddressCollection(aList, bList) {
  _.each(bList, function (bObj) {
    var aObj = _.find(aList, {path: bObj.path});
    if (aObj) {
      _.merge(aObj, bObj);
    } else {
      aList.push(bObj);
    }
  });
  return aList;
}

function setFirstUnused(wallet, chainIndex, addressNode) {
  var chain = _.find(wallet.chains, {index: chainIndex});
  chain.firstUnused = addressNode;
}

function getUnusedAddressNode(wallet, chainIndex) {
  return httpClient.get(unusedAddressesUrl(wallet.name))
    .then(function (newData) {
      updateWallet(wallet, newData);
      var chain = _.find(newData.chains, {index: chainIndex});
      if (chain && chain.chain_addresses && chain.chain_addresses.length) {
        var firstUnused = chain.chain_addresses[0];
        setFirstUnused(wallet, chainIndex, firstUnused);
        return firstUnused;
      } else {
        return addNewAddressToChain(wallet, chainIndex);
      }
    });
}

function addNewAddressToChain(wallet, chainIndex) {
  return httpClient.post(
    deriveAddressesUrl(wallet.name),
    JSON.stringify(deriveAddressesPayload(chainIndex))
  )
    .then(function (data) {
      updateWallet(wallet, data);
      var newAddressChain = _.find(data.chains, {index: chainIndex});
      var firstUnused = newAddressChain.chain_addresses[0];
      setFirstUnused(wallet, chainIndex, firstUnused);
      return firstUnused;
    });
}

function translateToLocalFormat(wallet) {
  var returnValue = _.extend({}, wallet);

  returnValue.id = 0;
  returnValue.hdNode = 'm/44\'/0\'/' + returnValue.id + '\'';
  returnValue.xpub = wallet.extended_public_key;

  delete returnValue.extended_public_key;

  return returnValue;
}

function getTransactionUrl(hash) {
  //https://api.blockcypher.com/v1/btc/main/txs/{{transaction-hash}}?token={{api-token}}
  return [
    [API_ROOT, TX_PATH, hash].join('/'),
    [
      API_TOKEN_PARAMETER,
      urlParameter('limit', '500')
    ].join('&')
  ].join('?');

}

function getTransaction(transactionHash) {
  return httpClient.get(getTransactionUrl(transactionHash));
}

function sendRawTransactionUrl() {
  return [
    [API_ROOT, SEND_RAW_TRANSACTION_PATH].join('/'),
    API_TOKEN_PARAMETER
  ].join('?');
}

function sendRawTransactionPayload(rawTransaction) {
  return {
    tx: rawTransaction.toHex()
  };
}

function sendRawTransaction(rawTransaction) {
  return httpClient.post(
    sendRawTransactionUrl(),
    JSON.stringify(sendRawTransactionPayload(rawTransaction))
  );
}

function getWebsiteTransactionUrl(hash) {
  return 'https://live.blockcypher.com/btc/tx/' + hash + '/';
}

module.exports = {
  sendTransactionUrl: sendTransactionUrl,
  getWallet: getWallet,
  getUnusedAddressNode: getUnusedAddressNode,
  getUnspentTransactionSummaries: _.curryRight(getTransactions)(getSummaryDecorator),
  getTransactionHistory: _.curryRight(getTransactions)(getHistoryDecorator),
  getTransaction: getTransaction,
  getTransactionUrl: getWebsiteTransactionUrl,
  deleteWallet: deleteWallet,
  sendRawTransaction: sendRawTransaction
};