var proxyquire = require('proxyquire');
var chai = require('chai');
var sinon = require('sinon');
var _ = require('lodash');

var assert = _.extend({}, chai.assert, sinon.assert);

describe("client:pinMatrixAck", function () {
    var mockFeatureService;
    var pinMatrixAckObject;
    var mockClient;
    var mockMessageBuffer = {
        command: 'PinMatrixAck'
    };
    var mockFeatures = {
        initialized: true
    };

    beforeEach(function () {
        mockFeatureService = proxyquire('./pinMatrixAck.js', {
            '../featuresService.js': {
                getPromise: sinon.stub()
                    .returns(Promise.resolve(mockFeatures))
            }
        });

        mockClient = {
            protoBuf: {
                PinMatrixAck: sinon.stub().returns(mockMessageBuffer)
            },
            writeToDevice: sinon.stub().returns(Promise.resolve({}))
        };

        pinMatrixAckObject = require('./pinMatrixAck.js').bind(mockClient);
    });

    it('returns a promise', function () {
        assert.instanceOf(pinMatrixAckObject({}), Promise);
    });
    it('creates a PinMatrixAck protobuf message', function () {
        return pinMatrixAckObject()
            .then(function () {
                assert.calledOnce(mockClient.protoBuf.PinMatrixAck);
                assert.calledWith(mockClient.protoBuf.PinMatrixAck, '');
            });

    });
    it('passes arguments to the PinMatrixAck protobuf message factory', function () {
        var testArguments = {
            pin: '314159'
        };
        return pinMatrixAckObject(testArguments)
            .then(function () {
                assert.calledOnce(mockClient.protoBuf.PinMatrixAck);
                assert.calledWith(mockClient.protoBuf.PinMatrixAck, testArguments.pin);
            });

    });
    it("writes the message through the bound client object", function () {
        return pinMatrixAckObject({})
            .then(function () {
                assert.calledOnce(mockClient.writeToDevice);
                assert.calledWith(mockClient.writeToDevice, mockMessageBuffer);
            });
    });
});