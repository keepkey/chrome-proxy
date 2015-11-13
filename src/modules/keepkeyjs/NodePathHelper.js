var uint32 = require('uint32');
var _ = require('lodash');

const PRIME_DERIVATION_FLAG = 0x80000000;

function convertPrime(n) {
  var i = 0, max = n.length;

  for (; i < max; i += 1) {
    if (n[i] < 0) {
      n[i] = uint32.or(Math.abs(n[i]), PRIME_DERIVATION_FLAG);
    }
  }

  return n;
}

function readNodePath(addressN) {
  if (!addressN) {
    return null;
  }
  if (typeof addressN === "string") {
    addressN = addressN.toUpperCase().split('/');

    if (addressN[0] === 'M') {
      addressN = addressN.slice(1);
    }
    addressN = _.transform(addressN, function (result, it) {
      if (it.substring(it.length - 1) === "'") {
        it = '-' + it.substring(0, it.length - 1);
      }

      if (it === '-0') {
        result.push(PRIME_DERIVATION_FLAG);
      } else {
        result.push(parseInt(it, 10));
      }
    }, []);
  }
  return convertPrime(addressN);
}

function toString(nodePathVector) {
  var converted = [];
  nodePathVector.forEach(function(it) {
    if (it & 0x80000000) {
      converted.push((it & 0x7fffffff) + '\'');
    } else {
      converted.push(it);
    }
  });
  return 'm/' + converted.join('/');
}

function joinPaths() {
  if (_.indexOf(arguments, undefined) !== -1) {
    return undefined;
  }
  return 'm/' + _.map(arguments, function (path) {
      return _.trim(path, 'm/');
    }).join('/');
}

module.exports = {
  toVector: readNodePath,
  joinPaths: joinPaths,
  toString: toString
};
