var proxyquire = require('proxyquire');
var chai = require('chai');
var sinon = require('sinon');
var _ = require('lodash');

var assert = _.extend({}, chai.assert, sinon.assert);

describe("client:getAddress", function () {
    var mockFeatureService;
    var getAddressObject;
    var mockClient;
    var mockMessageBuffer = {
        command: 'GetAddress'
    };
    var mockFeatures = {
        initialized: true
    };

    beforeEach(function () {
        mockFeatureService = proxyquire('./getAddress.js', {
            '../featuresService.js': {
                getPromise: sinon.stub()
                    .returns(Promise.resolve(mockFeatures))
            }
        });

        mockClient = {
            protoBuf: {
                GetAddress: sinon.stub().returns(mockMessageBuffer)
            },
            writeToDevice: sinon.stub().returns(Promise.resolve({}))
        };

        getAddressObject = require('./getAddress.js').bind(mockClient);
    });

    it('returns a promise', function () {
        assert.instanceOf(getAddressObject({}), Promise);
    });
    it('creates a GetAddress protobuf message', function () {
        return getAddressObject()
            .then(function () {
                assert.calledOnce(mockClient.protoBuf.GetAddress);
                assert.calledWith(mockClient.protoBuf.GetAddress, [0], 'Bitcoin', false);
            });

    });
    it('passes arguments to the GetAddress protobuf message factory', function () {
        var testArguments = {
            addressN: [314159],
            coinName: 'KeepKoin',
            showDisplay: true,
        };
        return getAddressObject(testArguments)
            .then(function () {
                assert.calledOnce(mockClient.protoBuf.GetAddress);
                assert.calledWith(mockClient.protoBuf.GetAddress,
                    testArguments.addressN,
                    testArguments.coinName,
                    testArguments.showDisplay
                );
            });

    });
    it("writes the message through the bound client object", function () {
        return getAddressObject({})
            .then(function () {
                assert.calledOnce(mockClient.writeToDevice);
                assert.calledWith(mockClient.writeToDevice, mockMessageBuffer);
            });
    });
});