var proxyquire = require('proxyquire');
var chai = require('chai');
var sinon = require('sinon');
var _ = require('lodash');

var assert = _.extend({}, chai.assert, sinon.assert);

describe("client:wipeDevice", function() {
    var wipeDeviceObject;
    var mockClient;
    var mockMessageBuffer = {
        command: 'wipeDevice'
    };
    var mockFeatures = {foo: 'bar'};

    beforeEach(function() {
        mockClient = {
            protoBuf: {
                WipeDevice: sinon.stub().returns(mockMessageBuffer)
            },
            writeToDevice: sinon.stub().returns(Promise.resolve({}))
        };

        wipeDeviceObject = require('./wipeDevice.js').bind(mockClient);
    });

    it('returns a promise', function() {
        assert.instanceOf(wipeDeviceObject(), Promise);
    });

    it('creates a WipeDevice protobuf message', function() {
        return wipeDeviceObject()
            .then(function() {
                assert.calledOnce(mockClient.protoBuf.WipeDevice);
                assert.calledWith(mockClient.protoBuf.WipeDevice);
            });

    });

    it("writes the message through the bound client object", function() {
        return wipeDeviceObject()
            .then(function() {
                assert.calledOnce(mockClient.writeToDevice);
                assert.calledWith(mockClient.writeToDevice, mockMessageBuffer);
            });
    });

});