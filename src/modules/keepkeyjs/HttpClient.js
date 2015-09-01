var _ = require('lodash');

var HttpClient = function () {
  function send(aUrl, payload, method, resolveStatuses) {
    return new Promise(function (resolve, reject) {
      var request = new XMLHttpRequest();
      request.onreadystatechange = function () {
        if (request.readyState === 4) {
          if (_.indexOf(resolveStatuses, request.status) !== -1) {
            if (request.response) {
              resolve(JSON.parse(request.response));
            } else {
              resolve('');
            }
          } else {
            reject(request.status);
          }
        }
      };
      request.open(method, aUrl, true);
      request.send(payload);
    });
  }

  this.get = _.curryRight(send)(null, 'GET', [200]);
  this.post = _.curryRight(send)('POST', [200, 201]);
  this.delete = _.curryRight(send)(null, 'DELETE', [200, 204]);
};

module.exports = new HttpClient();

