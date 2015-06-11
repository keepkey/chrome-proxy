var proxyquire = require('proxyquire');
var chai = require('chai');
var sinon = require('sinon');
var _ = require('lodash');

var assert = _.extend({}, chai.assert, sinon.assert);

describe("client:cancel", function () {
    var mockFeatureService;
    var cancelObject;
    var mockClient;
    var mockMessageBuffer = {
        command: 'Cancel'
    };
    var mockFeatures = {
        initialized: true
    };

    beforeEach(function () {
        mockFeatureService = proxyquire('./cancel.js', {
            '../featuresService.js': {
                getPromise: sinon.stub()
                    .returns(Promise.resolve(mockFeatures))
            }
        });

        mockClient = {
            protoBuf: {
                Cancel: sinon.stub().returns(mockMessageBuffer)
            },
            writeToDevice: sinon.stub().returns(Promise.resolve({}))
        };

        cancelObject = require('./cancel.js').bind(mockClient);
    });

    it('returns a promise', function () {
        assert.instanceOf(cancelObject(), Promise);
    });
    it('creates a Cancel protobuf message', function () {
        return cancelObject()
            .then(function () {
                assert.calledOnce(mockClient.protoBuf.Cancel);
                assert.calledWith(mockClient.protoBuf.Cancel);
            });

    });
    it("writes the message through the bound client object", function () {
        return cancelObject({})
            .then(function () {
                assert.calledOnce(mockClient.writeToDevice);
                assert.calledWith(mockClient.writeToDevice, mockMessageBuffer);
            });
    });
});