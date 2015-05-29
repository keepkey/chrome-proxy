var proxyquire = require('proxyquire');
var chai = require('chai');
var sinon = require('sinon');
var _ = require('lodash');

var assert = _.extend({}, chai.assert, sinon.assert);

describe("client:resetDevice", function () {
    var mockFeatureService;
    var resetDeviceObject;
    var mockClient;
    var mockMessageBuffer = {
        command: 'resetDevice'
    };
    var mockFeatures = {foo: 'bar'};

    beforeEach(function () {
        mockFeatureService = proxyquire('./resetDevice.js', {
            '../featuresService.js': {
                getPromise: sinon.stub().returns(Promise.resolve(mockFeatures))
            }
        });

        mockClient = {
            protoBuf: {
                ResetDevice: sinon.stub().returns(mockMessageBuffer)
            },
            writeToDevice: sinon.stub().returns(Promise.resolve({}))
        };

        resetDeviceObject = require('./resetDevice.js').bind(mockClient);
    });

    it('returns a promise', function () {
        assert.instanceOf(resetDeviceObject({}), Promise);
    });

    describe('when the device is not initialized', function () {
        beforeEach(function() {
            mockFeatures.initialized = false;
        });

        it('creates a ResetDevice protobuf message', function () {
            return resetDeviceObject({})
                .then(function () {
                    assert.calledOnce(mockClient.protoBuf.ResetDevice);
                    assert.calledWith(mockClient.protoBuf.ResetDevice,
                        false, 128, false, true, 'english', null);
                });

        });

        it('passes arguments from the arguments object to the message factory attached to the bound client object', function () {
            var testArgs = {
                display_random: true,
                strength: 256,
                passphrase_protection: true,
                pin_protection: false,
                language: 'pirate',
                label: 'yar'
            };

            return resetDeviceObject(testArgs)
                .then(function () {
                    assert.calledOnce(mockClient.protoBuf.ResetDevice);
                    assert.calledWith(mockClient.protoBuf.ResetDevice,
                        testArgs.display_random, testArgs.strength, testArgs.passphrase_protection,
                        testArgs.pin_protection, testArgs.language, testArgs.label
                    );
                });

        });

        it("writes the message through the bound client object", function () {
            return resetDeviceObject()
                .then(function () {
                    assert.calledOnce(mockClient.writeToDevice);
                    assert.calledWith(mockClient.writeToDevice, mockMessageBuffer);
                });
        });
    });
    describe('when the device is initialized', function() {
        var consoleErrorStub;
        beforeEach(function() {
            mockFeatures.initialized = true;
            consoleErrorStub = sinon.stub(console, "error");
        });

        afterEach(function() {
            consoleErrorStub.reset();
        });

        it('writes an error to the console and rejects the promise', function() {
            return resetDeviceObject()
                .then(function() {
                    assert.fail('Promise should be rejected');
                }, function() {
                    assert.calledOnce(consoleErrorStub);
                });
        });
    });
});