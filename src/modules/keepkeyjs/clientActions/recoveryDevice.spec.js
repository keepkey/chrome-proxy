var proxyquire = require('proxyquire');
var chai = require('chai');
var sinon = require('sinon');
var _ = require('lodash');

var assert = _.extend({}, chai.assert, sinon.assert);

describe("client:recoveryDevice", function () {
    var mockFeatureService;
    var recoveryDeviceObject;
    var mockClient;
    var mockMessageBuffer = {
        command: 'recoveryDevice'
    };
    var mockFeatures = {
        foo: 'bar',
        initialized: false
    };

    beforeEach(function () {
        mockFeatureService = proxyquire('./recoveryDevice.js', {
            '../featuresService.js': {
                getPromise: sinon.stub().returns(Promise.resolve(mockFeatures))
            }
        });

        mockClient = {
            protoBuf: {
                RecoveryDevice: sinon.stub().returns(mockMessageBuffer)
            },
            writeToDevice: sinon.stub().returns(Promise.resolve({}))
        };

        recoveryDeviceObject = require('./recoveryDevice.js').bind(mockClient);
    });

    it('returns a promise', function () {
        assert.instanceOf(recoveryDeviceObject({}), Promise);
    });

    describe('when the device isn\'t initialized', function () {
        beforeEach(function () {
            mockFeatures.initialized = false;
        });

        it('creates a RecoveryDevice protobuf message', function () {
            return recoveryDeviceObject()
                .then(function () {
                    assert.calledOnce(mockClient.protoBuf.RecoveryDevice);
                    assert.calledWith(mockClient.protoBuf.RecoveryDevice,
                        12, false, true, null, null, false, true);
                });

        });

        it('passes arguments from the arguments object to the message factory attached to the bound client object', function () {
            var testArgs = {
                passphrase_protection: true,
                pin_protection: false,
                language: 'pidgin',
                label: 'dat keep secret',
                word_count: 24,
                enforce_wordlist: true,
                use_character_cipher: false
            };

            return recoveryDeviceObject(testArgs)
                .then(function () {
                    assert.calledOnce(mockClient.protoBuf.RecoveryDevice);
                    assert.calledWith(mockClient.protoBuf.RecoveryDevice,
                        testArgs.word_count, testArgs.passphrase_protection, testArgs.pin_protection,
                        testArgs.language, testArgs.label, testArgs.enforce_wordlist, testArgs.use_character_cipher
                    );
                });

        });

        it("writes the message through the bound client object", function () {
            return recoveryDeviceObject()
                .then(function () {
                    assert.calledOnce(mockClient.writeToDevice);
                    assert.calledWith(mockClient.writeToDevice, mockMessageBuffer);
                });
        });
    });
    describe('when the device has been initialized', function () {
        var consoleErrorStub;

        beforeEach(function () {
            mockFeatures.initialized = true;
            consoleErrorStub = sinon.stub(console, 'error');
        });

        afterEach(function () {
            consoleErrorStub.restore();
        });

        it('logs an error and rejects the promise', function () {
            return recoveryDeviceObject()
                .then(function () {
                    assert.fail('Promise should be rejected');
                }, function (failure) {
                    assert.isString(failure);
                    assert.calledOnce(consoleErrorStub);
                });
        });
    });
});