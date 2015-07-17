var _ = require('lodash');

var HttpClient = function () {
    function send(aUrl, payload, method) {
        return new Promise(function (resolve, reject) {
            var request = new XMLHttpRequest();
            request.onreadystatechange = function () {
                if (request.readyState === 4) {
                    if (request.status === 200) {
                        resolve(JSON.parse(request.response));
                    } else {
                        reject(request.status);
                    }
                }
            };
            request.open(method, aUrl, true);
            request.send(payload);
        });
    }
    this.get = _.curryRight(send)(null, 'GET');
    this.post = _.curryRight(send)('POST');
};

module.exports = new HttpClient();

