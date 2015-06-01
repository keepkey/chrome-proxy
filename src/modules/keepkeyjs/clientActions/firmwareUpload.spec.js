var proxyquire = require('proxyquire');
var chai = require('chai');
var sinon = require('sinon');
var ByteBuffer = require('bytebuffer');

describe("client:firmwareUpload", function () {
    var firmwareFileContents = "KPKY" +
        "0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF" +
        "0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF" +
        "0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF" +
        "0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF";

    var firmwareUploadObject;
    var mockClient;
    var mockMessageBuffer = {
        command: 'firmwareUpload'
    };
    var mockFeatures = {
        foo: 'bar',
        initialized: false,
        bootloader_mode: true
    };
    var mockHashString = 'S3CUR1TY C0NFIRM3D';
    var mockHash = ByteBuffer.wrap(mockHashString).toArrayBuffer();
    var mockHashHex = ByteBuffer.wrap(mockHash).toHex();
    var mockFirmwareMetadata = {
        file: 'test.bin',
        size: 260,
        trezorDigest: mockHashHex,
        digest: mockHashHex
    };

    var mockLogger = {
        debug: sinon.stub(), //function() {console.log(arguments);},
        info: sinon.stub(), //function() {console.log(arguments);},
        error: sinon.stub()
    };

    var mocks = {
        '../digest.js': sinon.stub().returns(Promise.resolve(mockHash)),
        '../featuresService.js': {
            getPromise: sinon.stub().returns(Promise.resolve(mockFeatures))
        },
        '../../../../tmp/keepkey_main.js': mockFirmwareMetadata,
        './readFirmwareFile.js': sinon.spy(function() {
            return new Promise(function (resolve) {
                resolve(ByteBuffer.wrap(firmwareFileContents).toArrayBuffer());
            });
        }),
        '../../../logger.js': mockLogger
    };

    var readFirmwareFileStub = mocks['./readFirmwareFile.js'];

    beforeEach(function () {
        proxyquire('./firmwareUpload.js', mocks);

        mockClient = {
            protoBuf: {
                FirmwareUpload: sinon.stub().returns(mockMessageBuffer)
            },
            writeToDevice: sinon.stub().returns(Promise.resolve({})),
            eventEmitter: {
                emit: sinon.stub()
            }
        };

        firmwareUploadObject = require('./firmwareUpload.js').bind(mockClient);
    });

    afterEach(function () {
        mocks['../featuresService.js'].getPromise.reset();
        mocks['./readFirmwareFile.js'].reset();
        mockClient.protoBuf.FirmwareUpload.reset();
        mockLogger.debug.reset();
        mockLogger.info.reset();
        mockLogger.error.reset();
    });

    it('returns a promise', function () {
        chai.assert.instanceOf(firmwareUploadObject(), Promise);
    });

    it('fails and logs when the device isn\'t in bootloader mode', function () {
        mockFeatures.bootloader_mode = false;
        return firmwareUploadObject()
            .then(function () {
                chai.assert.fail('should fail when the device isn\'t in bootloader mode');
            }, function (message) {
                chai.assert.isString(message);
                chai.assert.equal(message, "Device must be in bootloader mode");
                sinon.assert.calledOnce(mockLogger.error);
                mockFeatures.bootloader_mode = true;
            });
    });

    it('gets the firmware filename from the firmware metadata file', function () {
        return firmwareUploadObject()
            .then(function () {
                sinon.assert.calledOnce(readFirmwareFileStub);
                sinon.assert.calledWith(readFirmwareFileStub, mockFirmwareMetadata.file);
            });
    });

    it('fails and logs when the firmware file size doesn\'t match the metadata', function () {
        var originalSize = mockFirmwareMetadata.size;
        mockFirmwareMetadata.size = 1;
        return firmwareUploadObject()
            .then(function () {
                chai.assert.fail('should fail when the size specified in the metadata file doesn\'t match the file size');
            }, function (message) {
                chai.assert.isString(message);
                chai.assert.ok(message.startsWith("Size of firmware file"));
                sinon.assert.calledOnce(mockLogger.error);
                mockFirmwareMetadata.size = originalSize;
            });
    });

    it('fails and logs when the payload hash doesn\'t match the hash specified in the metadata', function () {
        var originalValue = mockFirmwareMetadata.trezorDigest;
        mockFirmwareMetadata.trezorDigest = "FUDBUCKET";
        return firmwareUploadObject()
            .then(function () {
                chai.assert.fail('should fail when the payload hash is incorrect');
            }, function (message) {
                chai.assert.isString(message);
                chai.assert.ok(message.startsWith('firmware payload digest'));
                sinon.assert.calledOnce(mockLogger.error);
                mockFirmwareMetadata.trezorDigest = originalValue;
            });

    });
    it('fails and logs when the file hash doesn\'t match the hash specified in the metadata', function () {
        var originalValue = mockFirmwareMetadata.digest;
        mockFirmwareMetadata.digest = "CLINKENJAWMER";
        return firmwareUploadObject()
            .then(function () {
                chai.assert.fail('should fail when the payload hash is incorrect');
            }, function (message) {
                chai.assert.isString(message);
                chai.assert.ok(message.startsWith('firmware image digest'));
                sinon.assert.calledOnce(mockLogger.error);
                mockFirmwareMetadata.digest = originalValue;
            });

    });

    it('fails and logs when the firmware manufacturer tag isn\'t KPKY', function () {
        firmwareFileContents = firmwareFileContents.replace("KPKY", "RONG");

        return firmwareUploadObject()
            .then(function () {
                chai.assert.fail('should fail when the firmware manufacturer tag isn\'t KPKY');
            }, function (message) {
                chai.assert.isString(message);
                chai.assert.ok(message.startsWith('Firmware image is from an unknown manufacturer'));
                sinon.assert.calledOnce(mockLogger.error);

                firmwareFileContents = firmwareFileContents.replace("RONG", "KPKY");
            });
    });

    it('creates a device message with the FirmwareUpload message factory', function () {
        return firmwareUploadObject()
            .then(function () {
                sinon.assert.calledOnce(mockClient.protoBuf.FirmwareUpload);

                var hash = mockClient.protoBuf.FirmwareUpload.args[0][0];
                chai.assert.instanceOf(hash, ByteBuffer);
                chai.assert.equal(hash.toString('utf8'), mockHashString);

                var payload = mockClient.protoBuf.FirmwareUpload.args[0][1];
                chai.assert.instanceOf(payload, ByteBuffer);
                chai.assert.equal(payload.toString('utf8'), firmwareFileContents);
            });
    });

    it('sends the constructed message to the device', function () {
        return firmwareUploadObject()
            .then(function () {
                sinon.assert.calledOnce(mockClient.writeToDevice);
                sinon.assert.calledWith(mockClient.writeToDevice, mockMessageBuffer);
            });
    });
});