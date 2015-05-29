var ByteBuffer = require('bytebuffer');

module.exports = function(fileName) {
    return new Promise(function (resolve, reject) {
        // running in a browser
        var myRequest = new XMLHttpRequest();
        myRequest.onloadend = function () {
            resolve(this.response);
        };
        myRequest.open('GET', fileName, true);
        myRequest.responseType = 'arraybuffer';
        myRequest.send();
    });
};