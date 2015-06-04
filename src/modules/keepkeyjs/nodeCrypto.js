var ByteBuffer = require('bytebuffer');
var crypto = require('crypto');

module.exports = {
    getLocalEntropy: function (length) {
        var foo = ByteBuffer.wrap(crypto.randomBytes(length));
        return foo;
    }
};