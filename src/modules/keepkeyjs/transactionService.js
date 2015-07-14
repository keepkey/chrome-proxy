var _ = require('lodash');
var dbPromise = require('./dbPromise.js');
var EventEmitter2 = require('eventemitter2').EventEmitter2;
var chainApiKey = 'bae5d67396c223d643b574df299225ba';
var walletNodeService = require('./walletNodeService.js');

const TRANSACTIONS_STORE_NAME = 'transactions';

var eventEmitter = new EventEmitter2();

//TODO Move this to a module
var HttpClient = function () {
    function send(aUrl, payload, method) {
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
            request.open(method, aUrl, true);
            request.send(JSON.stringify({"signed_hex": payload}));
        });
    }
    this.get = _.curryRight(send)(null, 'GET');
    this.post = _.curryRight(send)('POST');
};

var httpClient = new HttpClient();

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
    return httpClient.post(
        'https://api.chain.com/v2/bitcoin/transactions/send' +
        '?api-key-id=' + chainApiKey,
        rawtransaction.toHex()
    );
};

const SPENT = -1;
const RECEIVED = 1;

function storeTransaction(db, transaction) {
    var store = db
        .transaction(TRANSACTIONS_STORE_NAME, 'readwrite')
        .objectStore(TRANSACTIONS_STORE_NAME);

    store.transaction.oncomplete = function (event) {
        eventEmitter.emit('changed', transactions.transactions);
    };

    return store.put(transaction);
}

function upsertTransaction(transactionFragment) {
    var oldTransactions = JSON.parse(JSON.stringify(transactions.transactions));

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

    dbPromise.then(function (db) {
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
        upsertTransaction({
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

var requestTransactionsFromBlockchainProvider = function () {
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
            });
    }
    else {
        return Promise.resolve();
    }
};

var getTransactionsFromLocalDataStore = function (db) {
    // Get existing transactions from indexeddb
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

var subscribeToNewTransactions = function (db) {
    return new Promise(function (resolve) {
        var conn = new WebSocket("wss://ws.chain.com/v2/notifications");
        conn.onopen = function (ev) {
            _.each(walletNodeService.getAddressList(), function (address) {
                var req = {
                    type: "address",
                    address: address,
                    block_chain: "bitcoin"
                };
                conn.send(JSON.stringify(req));
            });
            resolve(db);
        };
        conn.onmessage = function (ev) {
            var transaction = JSON.parse(ev.data).payload;
            if (transaction.type === 'address') {
                //FIXME This doesn't fill in all of the fields that are needed.
                //FIXME It leaves the data in a corrupted state.
                //upsertTransaction({
                //    transactionHash: transaction.transaction_hash,
                //    fragmentIndex: transaction.sent ?
                //        _.indexOf(transaction.input_addresses, transaction.address) :
                //        _.indexOf(transaction.output_addresses, transaction.address),
                //    address: transaction.address,
                //    nodePath: walletNodeService.addressNodePath(transaction.address),
                //    type: transaction.sent ? SPENT : RECEIVED,
                //    amount: transaction.received - transaction.sent,
                //    confirmations: transaction.confirmations,
                //    spent: transaction.spent
                //});
            }
        };
        conn.onclose = function (ev) {
            console.error('>>>>>>>>>>>>>>>websocket closed<<<<<<<<<<<<<<<<<<');
        };
    });
};
dbPromise
    .then(getTransactionsFromLocalDataStore)
    .then(subscribeToNewTransactions)
    .then(requestTransactionsFromBlockchainProvider)
    .then(function () {
        walletNodeService.addListener('changed', requestTransactionsFromBlockchainProvider);
    });

walletNodeService.registerTransactionService(transactions);

module.exports = transactions;