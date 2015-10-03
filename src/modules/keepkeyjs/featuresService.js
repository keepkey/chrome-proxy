var _ = require('lodash');

var promiseResolver;
var promise = new Promise(function (resolve) {
  promiseResolver = resolve;
});
var resolved = false;
var data = {};

var setValue = function (value) {
  _.extend(data, value);

  if (!resolved) {
    resolved = true;
    promiseResolver(data);
  }
};

var clear = function () {
  for (var prop in data) {
    if (data.hasOwnProperty(prop)) {
      delete data[prop];
    }
  }
};

var getPromise = function () {
  return promise;
};

module.exports = {
  setValue: setValue,
  clear: clear,
  getPromise: getPromise
};

