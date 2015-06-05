var ByteBuffer = require('bytebuffer');
var crypto = require('crypto');

module.exports = {
    getLocalEntropy: function (length) {
        return ByteBuffer.wrap(crypto.randomBytes(length));
    },
    digest: function(method, payload) {
        method = method.replace('-', '');

        var shasum = crypto.createHash(method);
        shasum.update(ByteBuffer.wrap(payload).toBuffer());

        return Promise.resolve(shasum.digest());
    }
};