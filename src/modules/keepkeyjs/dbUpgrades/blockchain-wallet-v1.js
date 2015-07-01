const DB_NAME = 'blockchain-wallet';
const NODES_STORE_NAME = 'nodes';
const NODES_KEY_PATH = 'id';
const NODES_NAMES_INDEX_NAME = 'name_idx';
const NODES_NAME_PATH = 'name';
const TRANSACTIONS_STORE_NAME = 'transactions';
const TRANSACTIONS_KEY_PATH = 'id';
const TRANSACTIONS_NODE_INDEX_NAME = 'node_idx';
const TRANSACTIONS_NODE_INDEX_PATH = 'walletNode';

module.exports = function(event, db, tx) {
    var objStore;
    objStore = db.createObjectStore(NODES_STORE_NAME, {
        keyPath: NODES_KEY_PATH,
        autoIncrement : true
    });
    objStore.createIndex(
        NODES_NAMES_INDEX_NAME,
        NODES_NAME_PATH,
        {unique: false}
    );

    objStore = db.createObjectStore(TRANSACTIONS_STORE_NAME, {
        keyPath: TRANSACTIONS_KEY_PATH,
        autoIncrement : true
    });
    objStore.createIndex(
        TRANSACTIONS_NODE_INDEX_NAME,
        TRANSACTIONS_NODE_INDEX_PATH,
        {unique: false}
    );

    objStore.transaction.oncomplete = function(event) {
        var walletNodeObjectStore = db
            .transaction(NODES_STORE_NAME, "readwrite")
            .objectStore(NODES_STORE_NAME);

        var testWallet1 = {
            hdNode: "m/44'/0'/0'",
            id: 0,
            name: "Shopping",
            nodePath: [2147483692, 2147483648, 2147483648],
            balance: 22.57293
        };
        var testWallet2 = {
            hdNode: "m/44'/0'/1'",
            id: 1,
            name: "Retirement Savings",
            nodePath: [2147483692, 2147483648, 2147483649],
            balance: 0.65
        };

        walletNodeObjectStore.add(testWallet1);
        walletNodeObjectStore.add(testWallet2);
    };

};