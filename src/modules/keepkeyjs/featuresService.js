var promiseResolver;
var promise = new Promise(function (resolve) {
    promiseResolver = resolve;
});
var resolved = false;

module.exports.setValue = function (value) {
    if (!resolved) {
        resolved = true;
        promiseResolver(value);
    } else {
        promise = Promise.resolve(value);
    }
};

module.exports.getPromise = function () {
    return promise;
};


