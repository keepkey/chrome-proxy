var proxyquire = require('proxyquire');

var sinon = require('sinon');
var assert = require('chai').assert;

describe('blockcypher-wallet', function () {
  var blockcypherWallet;

  var getStub = sinon.stub();
  var postStub = sinon.stub();
  var deleteStub = sinon.stub();

  beforeEach(function() {
    proxyquire('./blockcypher-wallet.js', {
      '../HttpClient.js': {
        'get': getStub,
        'post': postStub,
        'delete': deleteStub
      }
    });
    blockcypherWallet = require('./blockcypher-wallet.js');
  });

  afterEach(function() {
    getStub.reset();
    postStub.reset();
    deleteStub.reset();
  });

  it('requests the wallet and returns the data when the wallet exists', function() {
    const testKey = 'WICKAWICKAWOO';
    const testName = 'foo';

    const mockWallet = {
      name: testName,
      extended_public_key: testKey
    };

    getStub.returns(Promise.resolve(mockWallet));

    return blockcypherWallet.getWallet(testName, testKey)
      .then(function(data) {
        assert.isTrue(getStub.calledOnce);
        assert.deepEqual(data, {
          id: 0,
          name: testName,
          xpub: testKey,
          hdNode: 'm/44\'/0\'/0\''
        });
      });
  });

  it('creates a new wallet when the requested wallet doesn\'t exist', function() {
    const testKey = 'WICKAWICKAWOO';
    const testName = 'foo';

    const mockWallet = {
      name: testName,
      extended_public_key: testKey
    };

    getStub.returns(Promise.reject(404));
    postStub.returns(Promise.resolve(mockWallet));

    return blockcypherWallet.getWallet(testName, testKey)
      .then(function(data) {
        assert.isTrue(getStub.calledOnce, 'get not called');
        assert.isTrue(postStub.calledOnce, 'post not called');
        assert.deepEqual(data, {
          id: 0,
          name: testName,
          xpub: testKey,
          hdNode: 'm/44\'/0\'/0\''
        });
      });
  });

  it('deletes existing and creates a new wallet when the requested wallet doesn\'t match', function() {
    const testKey = 'WICKAWICKAWOO';
    const testKey_existingWallet = 'CHOOCHIEWOOCHIE';
    const testName = 'foo';

    const mockWallet = {
      name: testName,
      extended_public_key: testKey
    };

    const mockExistingWallet = {
      name: testName,
      extended_public_key: testKey_existingWallet
    };

    getStub.returns(Promise.resolve(mockExistingWallet));
    deleteStub.returns(Promise.resolve());
    postStub.returns(Promise.resolve(mockWallet));

    return blockcypherWallet.getWallet(testName, testKey)
      .then(function(data) {
        assert.isTrue(getStub.calledOnce, 'get not called');
        assert.isTrue(deleteStub.calledOnce, 'delete not called');
        assert.isTrue(postStub.calledOnce, 'post not called');
        assert.deepEqual(data, {
          id: 0,
          name: testName,
          xpub: testKey,
          hdNode: 'm/44\'/0\'/0\''
        });
      });
  });
});