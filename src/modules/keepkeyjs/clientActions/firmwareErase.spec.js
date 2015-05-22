var proxyquire = require('proxyquire');
var chai = require('chai');
var sinon = require('sinon');

var extend = require('extend-object');

var assert = extend({}, chai.assert, sinon.assert);

describe("client:eraseFirmware", function () {
    var mockFeatureService;
    var firmwareEraseObject;
    var mockClient;
    var mockMessageBuffer = {
        command: 'FirmwareErase'
    };
    var mockFeatures = {
        bootloader_mode: true
    };

    beforeEach(function () {
        mockFeatureService = proxyquire('./firmwareErase.js', {
            '../featuresService.js': {
                getPromise: sinon.stub()
                    .returns(Promise.resolve(mockFeatures))
            }
        });

        mockClient = {
            protoBuf: {
                FirmwareErase: sinon.stub().returns(mockMessageBuffer)
            },
            writeToDevice: sinon.stub().returns(Promise.resolve({}))
        };

        firmwareEraseObject = require('./firmwareErase.js').bind(mockClient);
    });

    it('returns a promise', function () {
        assert.instanceOf(firmwareEraseObject({}), Promise);
    });

    describe("when the client is in bootloader mode", function () {
        beforeEach(function () {
            mockFeatures.bootloader_mode = true;
        });
        it('creates a FirmwareErase protobuf message', function () {
            return firmwareEraseObject()
                .then(function () {
                    assert.calledOnce(mockClient.protoBuf.FirmwareErase);
                    assert.calledWith(mockClient.protoBuf.FirmwareErase);
                });

        });
        it("writes the message through the bound client object", function () {
            return firmwareEraseObject({})
                .then(function () {
                    assert.calledOnce(mockClient.writeToDevice);
                    assert.calledWith(mockClient.writeToDevice, mockMessageBuffer);
                });
        });
    });

    it("rejects the promise when the device isn't in bootloader mode", function () {
        mockFeatures.bootloader_mode = false;
        return firmwareEraseObject({})
            .catch(function (message) {
                assert.typeOf(message, 'string');
            });
    });
});