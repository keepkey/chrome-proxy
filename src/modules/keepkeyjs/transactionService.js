var _ = require('lodash');
var dbPromise = require('./dbPromise.js');
var EventEmitter2 = require('eventemitter2').EventEmitter2;
var chainApiKey = 'bae5d67396c223d643b574df299225ba';
var walletNodeService = require('./walletNodeService.js');
var httpClient = require('./HttpClient.js');

const TRANSACTIONS_STORE_NAME = 'transactions';

const SPENT = -1;
const RECEIVED = 1;

var eventEmitter = new EventEmitter2();

var transactions = {
    transactions: [],
    addListener: eventEmitter.addListener.bind(eventEmitter)
};

transactions.addressIsUnused = function(address) {
    return !_.find(transactions.transactions, {address: address});
};

transactions.getByTransactionHash = function(hash) {
    var txFrag =  _.find(transactions.transactions, {
        transactionHash: hash
    });
    return txFrag ? txFrag.transaction : txFrag;
};

transactions.sendTransaction = function(rawtransaction) {
    console.log('raw tx:', rawtransaction.toHex());
    return httpClient.post(
        'https://api.chain.com/v2/bitcoin/transactions/send' +
        '?api-key-id=' + chainApiKey,
        JSON.stringify({
            "signed_hex": rawtransaction.toHex()
        })
    );
};

transactions.reloadTransactions = function requestTransactionsFromBlockchainProvider() {
    var walletAddresses = walletNodeService.getAddressList();

    if (walletAddresses.length) {
        var url = [
            'https://api.chain.com/v2/bitcoin/addresses/',
            walletAddresses.join(','),
            '/transactions?api-key-id=',
            chainApiKey,
            '&limit=500'
        ].join('');

        return httpClient.get(url)
            .then(function (data) {
                _.each(data, function (transaction) {
                    _.each(transaction.inputs, processTransactionSegmentFactory(walletAddresses, SPENT, transaction));
                    _.each(transaction.outputs, processTransactionSegmentFactory(walletAddresses, RECEIVED, transaction));
                });
            })
            .then(function(data) {
                eventEmitter.emit('changed');
            });
    }
    else {
        return Promise.resolve();
    }
};

function storeTransaction(db, transaction) {
    var store = db
        .transaction(TRANSACTIONS_STORE_NAME, 'readwrite')
        .objectStore(TRANSACTIONS_STORE_NAME);

    return store.put(_.omit(transaction, '$$idPromise'));
}

function upsertTransaction(transactionFragment) {
    var criteria = {
        transactionHash: transactionFragment.transactionHash,
        type: transactionFragment.type,
        fragmentIndex: transactionFragment.fragmentIndex
    };
    var existingTransaction = _.find(transactions.transactions, criteria);

    if (existingTransaction) {
        existingTransaction.confirmations = transactionFragment.confirmations;
        existingTransaction.spent = transactionFragment.spent;
        existingTransaction.transaction = transactionFragment.transaction;
        transactionFragment = existingTransaction;
    } else {
        transactions.transactions.push(transactionFragment);
    }

    return dbPromise.then(function (db) {
        var request;
        if (transactionFragment.id) {
            storeTransaction(db, transactionFragment);
        } else {
            if (transactionFragment.$$idPromise) {
                transactionFragment.$$idPromise
                    .then(function(id) {
                        storeTransaction(db, transactionFragment);
                    });
            }
            else {
                transactionFragment.$$idPromise = new Promise(function(resolve) {
                    request = storeTransaction(db, transactionFragment);

                    request.onsuccess = function (event) {
                        transactionFragment.id = event.target.result;
                        resolve(transactionFragment.id);
                    };
                });
            }
        }
    });
}


function processTransactionFragment(walletAddresses, type, transaction, fragment, index) {
    var matches = _.intersection(fragment.addresses, walletAddresses);
    if (matches.length) {
        return upsertTransaction({
            transactionHash: transaction.hash,
            fragmentIndex: index,
            address: (matches.length === 1) ? matches[0] : matches,
            nodePath: walletNodeService.addressNodePath(matches[0]),
            type: type,
            amount: (type === SPENT) ? -fragment.value : fragment.value,
            transaction: transaction,
            confirmations: transaction.confirmations,
            spent: fragment.spent
        });
    }
}

var processTransactionSegmentFactory = _.curry(processTransactionFragment);

var getTransactionsFromLocalDataStore = function (db) {
    return new Promise(function (resolve) {
        var store = db
            .transaction(TRANSACTIONS_STORE_NAME, 'readonly')
            .objectStore(TRANSACTIONS_STORE_NAME);

        var oldTransactions = JSON.parse(JSON.stringify(transactions.transactions));

        store.openCursor().onsuccess = function (event) {
            var cursor = event.target.result;
            if (cursor) {
                transactions.transactions.push(cursor.value);
                cursor.continue();
            }
            else {
                eventEmitter.emit('changed', transactions.transactions, oldTransactions);
                resolve(db);
            }
        };
    });
};

dbPromise
    .then(getTransactionsFromLocalDataStore)
    .then(transactions.requestTransactionsFromBlockchainProvider)
    .then(function () {
        walletNodeService.addListener('changed',
            transactions.requestTransactionsFromBlockchainProvider);
    });

walletNodeService.registerTransactionService(transactions);

module.exports = transactions;