var proxyquire = require('proxyquire');
var chai = require('chai');
var sinon = require('sinon');
var _ = require('lodash');

var assert = _.extend({}, chai.assert, sinon.assert);

describe("client:getPublicKey", function () {
    var mockFeatureService;
    var getPublicKeyObject;
    var mockClient;
    var mockMessageBuffer = {
        command: 'GetPublicKey'
    };
    var mockFeatures = {
        initialized: true
    };

    beforeEach(function () {
        mockFeatureService = proxyquire('./getPublicKey.js', {
            '../featuresService.js': {
                getPromise: sinon.stub()
                    .returns(Promise.resolve(mockFeatures))
            }
        });

        mockClient = {
            protoBuf: {
                GetPublicKey: sinon.stub().returns(mockMessageBuffer)
            },
            writeToDevice: sinon.stub().returns(Promise.resolve({})),
            addListener: sinon.stub(),
            eventEmitter: {
                off: sinon.stub()
            }
        };

        getPublicKeyObject = require('./getPublicKey.js').bind(mockClient);
    });

    afterEach(function() {
       mockClient.addListener.yield('PublicKey');
    });

    it('returns a promise', function () {
        assert.instanceOf(getPublicKeyObject({}), Promise);
    });
    it('creates a GetPublicKey protobuf message', function () {
        return getPublicKeyObject()
            .then(function () {
                assert.calledOnce(mockClient.protoBuf.GetPublicKey);
                assert.calledWith(mockClient.protoBuf.GetPublicKey, [0]);
            });

    });
    it('accepts node identifiers in a string', function () {
        var testArguments = {
            addressN: "314159/0/2"
        };
        return getPublicKeyObject(testArguments)
            .then(function () {
                assert.calledOnce(mockClient.protoBuf.GetPublicKey);
                assert.calledWith(mockClient.protoBuf.GetPublicKey,
                    [314159, 0, 2]
                );
            });

    });
    it('accepts node identifiers in a string with the "M" prefix', function () {
        var testArguments = {
            addressN: "m/314159/0/2"
        };
        return getPublicKeyObject(testArguments)
            .then(function () {
                assert.calledOnce(mockClient.protoBuf.GetPublicKey);
                assert.calledWith(mockClient.protoBuf.GetPublicKey,
                    [314159, 0, 2]
                );
            });

    });
    it('hardens nodes tagged with \' in a string', function () {
        var testArguments = {
            addressN: "44'/0'/2'"
        };
        return getPublicKeyObject(testArguments)
            .then(function () {
                assert.calledOnce(mockClient.protoBuf.GetPublicKey);
                assert.calledWith(mockClient.protoBuf.GetPublicKey,
                    [0x8000002C, 0x80000000, 0x80000002]
                );
            });

    });
    it('passes arguments to the GetPublicKey protobuf message factory', function () {
        var testArguments = {
            addressN: [314159]
        };
        return getPublicKeyObject(testArguments)
            .then(function () {
                assert.calledOnce(mockClient.protoBuf.GetPublicKey);
                assert.calledWith(mockClient.protoBuf.GetPublicKey,
                    testArguments.addressN
                );
            });

    });
    it("writes the message through the bound client object", function () {
        return getPublicKeyObject({})
            .then(function () {
                assert.calledOnce(mockClient.writeToDevice);
                assert.calledWith(mockClient.writeToDevice, mockMessageBuffer);
            });
    });
    it("queues requests and waits for a response");
    it("resolves the initial promise when the corresponding response is received");
});