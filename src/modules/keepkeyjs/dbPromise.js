var indexedDB;

if (typeof window !== 'undefined') {
    indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
}

const DB_NAME = 'blockchain-wallet';

var upgradesByVersion = [];
upgradesByVersion[1] = require('./dbUpgrades/blockchain-wallet-v1.js');

var applyNeededUpgrades = function (oldVersion, event, db, tx) {
    var version;
    for (version in upgradesByVersion) {
        if (upgradesByVersion.hasOwnProperty(version) && version > oldVersion) {
            console.log("indexedDB: Running upgrade : " + version + " from " + oldVersion);
            upgradesByVersion[version](event, db, tx);
        }
    }
};

module.exports = new Promise(function (resolve) {
    var request = indexedDB.open(DB_NAME, 1);
    request.onsuccess = function (event) {
        resolve(event.target.result);
    };
    request.onupgradeneeded = function (event) {
        var db = event.target.result;
        var tx = event.target.transaction;
        console.log("indexedDB: Upgrading database '" + db.name + "' from version " + event.oldVersion + " to version " + event.newVersion + " ...");
        applyNeededUpgrades(event.oldVersion, event, db, tx);
    };
});
