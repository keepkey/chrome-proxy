describe('transport', function() {
    var assert = require('chai').assert,
        transport = require('./transport.js'),
        sampleDeviceId = 34;

    describe('transport module', function () {

        beforeEach(function () {
            this.createdTransport = transport.create(sampleDeviceId);
        });

        afterEach(function () {
            transport.remove(this.createdTransport.getDeviceId());
        });

        describe('.create', function () {
            it('should return an object with 9 commands', function () {
                assert('object' === typeof(this.createdTransport));
                assert(9 === Object.keys(this.createdTransport).length);
                // assert.deepEqual(
                // ['_read', '_write', 'buildMessageMap', 'getDeviceId', 'getDeviceInfo', 'getMsgType', 'getMsgClass',
                // 'read', 'startSession', 'stopSession', 'write'],
                // Object.keys(this.createdTransport).sort());
            });
        });

        describe('.hasDeviceId()', function () {
            it('should return true if transport exists for given device id', function () {
                assert(transport.hasDeviceId(sampleDeviceId));
            });
            it('should return false if transport does not exist for given device id', function () {
                assert(transport.hasDeviceId(2) === false);
            });
        });

        describe('.getDeviceIds()', function () {
            it('should return a list', function () {
                assert(Array.isArray(transport.getDeviceIds()));
            });
            it('should contain the device id of devices that have transports', function () {
                assert(transport.getDeviceIds().indexOf(sampleDeviceId.toString()) !== -1);
            });
        });

        describe('.find()', function () {
            it('should find and return transport', function () {
                assert('object' === typeof(transport.find(sampleDeviceId)));
            });
            it('should not find transports for device ids that don\'t exist', function () {
                assert(undefined === transport.find(sampleDeviceId + 1));
            });
        });

        describe('.remove()', function () {
            it('should remove a transport by device id', function () {
                assert.equal(transport.getDeviceIds().length, 1, 'one devices initially');

                transport.create(sampleDeviceId + 1);
                assert.equal(transport.getDeviceIds().length, 2, 'device added');

                transport.remove(sampleDeviceId + 1);
                assert(transport.hasDeviceId(sampleDeviceId + 1) === false);
                assert.equal(transport.getDeviceIds().length, 1, 'device removed');
            });
        });
    });

    describe('transport object', function () {
        beforeEach(function () {
            this.createdTransport = transport.create(sampleDeviceId);
        });

        afterEach(function () {
            transport.remove(sampleDeviceId);
        });

        describe('.getDeviceId', function () {
            it('should return transport\'s device id', function () {
                assert(this.createdTransport.getDeviceId() === sampleDeviceId);
            });
        });
    });

});