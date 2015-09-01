var httpClient = require('./HttpClient.js');

var sinon = require('sinon');
var assert = require('chai').assert;

describe.skip('HttpClient -- broken in node', function () {
  var server;

  beforeEach(function () {
    server = sinon.fakeServer.create();
    console.log(server);
  });

  afterEach(function () {
    server.restore();
  });

  it('should accept 204 as a resolvable status code for DELETE', function () {
    var response204 = [
      204,
      {'Content-type': 'application/json'},
      ''
    ];
    var testUrl = '/test/url';

    server.respondWith('DELETE', testUrl, response204);

    var promise = httpClient.delete(testUrl);

    //setTimeout(function () {
    //  assert.equal(requests.length, 1);
    //  requests[0].respond(204);
    //}, 0);
    return promise;
  });
});
