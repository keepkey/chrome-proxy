var proxyquire = require('proxyquire');
var chai = require('chai');
var sinon = require('sinon');
var _ = require('lodash');

var assert = _.extend({}, chai.assert, sinon.assert);

describe("client:endSession", function () {
    var mockFeatureService;
    var endSessionObject;
    var mockClient;
    var mockMessageBuffer = {
        command: 'GetAddress'
    };
    var mockFeatures = {
        initialized: true
    };

    beforeEach(function () {
        mockFeatureService = proxyquire('./endSession.js', {
            '../featuresService.js': {
                getPromise: sinon.stub()
                    .returns(Promise.resolve(mockFeatures))
            }
        });

        mockClient = {
            protoBuf: {
                ClearSession: sinon.stub().returns(mockMessageBuffer)
            },
            writeToDevice: sinon.stub().returns(Promise.resolve({}))
        };

        endSessionObject = require('./endSession.js').bind(mockClient);
    });

    it('returns a promise', function () {
        assert.instanceOf(endSessionObject({}), Promise);
    });
    it('creates a ClearSession protobuf message', function () {
        return endSessionObject()
            .then(function () {
                assert.calledOnce(mockClient.protoBuf.ClearSession);
                assert.calledWith(mockClient.protoBuf.ClearSession);
            });

    });
    it("writes the message through the bound client object", function () {
        return endSessionObject({})
            .then(function () {
                assert.calledOnce(mockClient.writeToDevice);
                assert.calledWith(mockClient.writeToDevice, mockMessageBuffer);
            });
    });
});