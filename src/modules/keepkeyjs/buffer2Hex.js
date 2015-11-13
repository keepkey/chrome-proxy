var _ = require('lodash');
var Long = require('long');

module.exports = function buffer2Hex(k, v) {
  if (v && v.buffer) {
    // NOTE: v.buffer is type Buffer in node and ArrayBuffer in chrome
    if (v.buffer instanceof Buffer) {
      return v.toHex();
    }

    var hexstring = '';
    if (v.limit > 1000) {
      return '<long buffer suppressed>';
    }
    for (var i = v.offset; i < v.limit; i++) {
      if (v.view[i] < 16) {
        hexstring += 0;
      }
      hexstring += v.view[i].toString(16);
    }
    return hexstring;
  } else if (v && !_.isUndefined(v.low) && !_.isUndefined(v.high) && !_.isUndefined(v.unsigned)) {
    return (new Long(v.low, v.high, v.unsigned)).toString();
  }
  return v;
};