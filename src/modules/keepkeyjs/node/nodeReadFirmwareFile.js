var ByteBuffer = require('bytebuffer');
var fs = require('fs');

module.exports = function(fileName) {
    return new Promise(function (resolve, reject) {
        fs.readFile('../bin/' + fileName, function (err, data) {
            if (err) {
                reject(err);
            } else {
                resolve(ByteBuffer.wrap(data).toArrayBuffer());
            }
        });
    });
};