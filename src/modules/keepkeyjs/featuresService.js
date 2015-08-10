var promiseResolver;
var promise = new Promise(function (resolve) {
  promiseResolver = resolve;
});
var resolved = false;

var setValue = function (value) {
  if (!resolved) {
    resolved = true;
    promiseResolver(value);
  } else {
    promise = Promise.resolve(value);
  }
};

var clear = function () {
  setValue({});
};

var getPromise = function () {
  return promise;
};

module.exports = {
  setValue: setValue,
  clear: clear,
  getPromise: getPromise
};

