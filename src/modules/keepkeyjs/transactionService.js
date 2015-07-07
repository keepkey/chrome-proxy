var _ = require('lodash');
var dbPromise = require('./dbPromise.js');
var EventEmitter2 = require('eventemitter2').EventEmitter2;
var chainApiKey = 'bae5d67396c223d643b574df299225ba';
var walletNodeService = require('./walletNodeService.js');


const TRANSACTIONS_STORE_NAME = 'transactions';

var eventEmitter = new EventEmitter2();

var transactions = {
    transactions: [],
    addListener: eventEmitter.addListener.bind(eventEmitter)
};

var HttpClient = function () {
    this.get = function (aUrl) {
        return new Promise(function (resolve, reject) {
            var request = new XMLHttpRequest();
            request.onreadystatechange = function () {
                if (request.readyState === 4) {
                    if (request.status === 200) {
                        resolve(JSON.parse(request.response));
                    } else {
                        reject(request.status);
                    }
                }
            };
            request.open("GET", aUrl, true);
            request.send(null);
        });
    };
};

var httpClient = new HttpClient();

const SPENT = -1;
const RECEIVED = 1;

function upsertTransaction(transactionFragment) {
    var oldTransactions = JSON.parse(JSON.stringify(transactions.transactions));

    var existingTransaction = _.find(transactions.transactions, {
        transactionHash: transactionFragment.transactionHash,
        type: transactionFragment.type,
        fragmentIndex: transactionFragment.fragmentIndex
    });

    if (existingTransaction) {
        existingTransaction.confirmations = transactionFragment.confirmations;
        transactionFragment = existingTransaction;
    } else {
        transactions.transactions.push(transactionFragment);
    }

    dbPromise.then(function (db) {
        var store = db
            .transaction(TRANSACTIONS_STORE_NAME, 'readwrite')
            .objectStore(TRANSACTIONS_STORE_NAME);

        store.transaction.oncomplete = function(event) {
            eventEmitter.emit('changed', transactions.transactions, oldTransactions);
        };

        var request = store.put(transactionFragment);
        request.onsuccess = function(event) {
            transactionFragment.id = event.target.result;
        };
    });
}


function processTransactionFragment(walletAddresses, type, transaction, fragment) {
    var matches = _.intersection(fragment.addresses, walletAddresses);
    if (matches.length) {
        upsertTransaction({
            transactionHash: transaction.hash,
            fragmentIndex: fragment.output_index,
            address:  (matches.length === 1) ? matches[0] : matches,
            nodePath: walletNodeService.addressNodePath(matches[0]),
            type: type,
            amount: (type === SPENT) ? -fragment.value : fragment.value,
            confirmations: transaction.confirmations
        });
    }
}

var processTransactionSegmentFactory = _.curry(processTransactionFragment);
walletNodeService.addListener('changed', function(nodes, oldNodes) {
    var walletAddresses = walletNodeService.getAddressList();

    if (walletAddresses.length) {
        httpClient.get(
            'https://api.chain.com/v2/bitcoin/addresses/' +
            walletAddresses.join(',') +
            '/transactions?api-key-id=' +
            chainApiKey +
            '&limit=500')
            .then(function (data) {
                _.each(data, function (transaction) {
                    _.each(transaction.inputs, processTransactionSegmentFactory(walletAddresses, SPENT, transaction));
                    _.each(transaction.outputs, processTransactionSegmentFactory(walletAddresses, RECEIVED, transaction));
                });
            });
    }
});

dbPromise
    .then(function (db) {
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
                    resolve(transactions.transactions);
                }
            };
        });
    });

module.exports = transactions;