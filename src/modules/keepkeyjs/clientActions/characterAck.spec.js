var proxyquire = require('proxyquire');
var chai = require('chai');
var sinon = require('sinon');

var extend = require('extend-object');

var assert = extend({}, chai.assert, sinon.assert);

describe("client:characterAck", function() {
    var mockFeatureService;
    var characterAckObject;
    var mockClient;
    var mockMessageBuffer = {
        command: 'characterAck'
    };
    var mockFeatures = {foo: 'bar'};

    beforeEach(function() {
        mockFeatureService = proxyquire('./characterAck.js', {
            '../featuresService.js': {
                getPromise: sinon.stub().returns(Promise.resolve(mockFeatures))
            }
        });

        mockClient = {
            protoBuf: {
                CharacterAck: sinon.stub().returns(mockMessageBuffer)
            },
            writeToDevice: sinon.stub().returns(Promise.resolve({}))
        };

        characterAckObject = require('./characterAck.js').bind(mockClient);
    });

    it('returns a promise', function() {
        assert.instanceOf(characterAckObject({}), Promise);
    });

    it('creates a CharacterAck protobuf message', function() {
        return characterAckObject({})
            .then(function() {
                assert.calledOnce(mockClient.protoBuf.CharacterAck);
                assert.calledWith(mockClient.protoBuf.CharacterAck,
                    null, null, null);
            });

    });

    it('passes arguments from the arguments object to the message factory attached to the bound client object', function() {
        var testArgs = {
            character: 'a',
            delete: false,
            done: true
        };

        return characterAckObject(testArgs)
            .then(function() {
                assert.calledOnce(mockClient.protoBuf.CharacterAck);
                assert.calledWith(mockClient.protoBuf.CharacterAck,
                    testArgs.character, testArgs.delete, testArgs.done);
            });

    });

    it("writes the message through the bound client object", function() {
        return characterAckObject({})
            .then(function() {
                assert.calledOnce(mockClient.writeToDevice);
                assert.calledWith(mockClient.writeToDevice, mockMessageBuffer);
            });
    });

});