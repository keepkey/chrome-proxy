const DB_NAME = 'blockchain-wallet';
const NODES_STORE_NAME = 'nodes';
const NODES_KEY_PATH = 'id';
const NODES_NAMES_INDEX_NAME = 'name_idx';
const NODES_NAME_PATH = 'name';
const TRANSACTIONS_STORE_NAME = 'transactions';
const TRANSACTIONS_KEY_PATH = 'id';
const TRANSACTIONS_NODE_INDEX_NAME = 'node_idx';
const TRANSACTIONS_NODE_INDEX_PATH = 'walletNode';
const TRANSACTION_HASH_INDEX_NAME = 'transaction_hash';
const TRANSACTION_HASH_INDEX_PATH = 'transactionHash';

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
    objStore.createIndex(
        TRANSACTION_HASH_INDEX_NAME,
        TRANSACTION_HASH_INDEX_PATH,
        {unique: false}
    );

    objStore.transaction.oncomplete = function(event) {
        var walletNodeObjectStore = db
            .transaction(NODES_STORE_NAME, "readwrite")
            .objectStore(NODES_STORE_NAME);

        var defaultWallet = {
            hdNode: "m/44'/0'/0",
            id: 0,
            name: "My Wallet",
            nodePath: [2147483692, 2147483648, 0]
        };
        walletNodeObjectStore.add(defaultWallet);
    };

};