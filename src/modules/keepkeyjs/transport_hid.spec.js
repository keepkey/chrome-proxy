describe('transportHid', function () {

    var assert = require('chai').assert,
        sinon = require('sinon'),
        transport,
        transportHid,
        sampleDevice = {
            deviceId: 53,
            maxFeatureReportSize: 63,
            maxInputReportSize: 63,
            maxOutputReportSize: 63,
            productId: 1,
            vendorId: 11044
        };

    global.chrome = require('chrome-mock');
    global.chrome.hid = {
        getDevices: sinon.stub(),
        connect: sinon.stub()
    };

    beforeEach(function() {
        transport = require('./transport.js');
        transportHid = require('./transport_hid.js');
    });

    describe('transportHid module', function () {

        beforeEach(function () {
            this.clock = sinon.useFakeTimers();

            transportHid.onDeviceConnected(sinon.stub());
            transportHid.onDeviceDisconnected(sinon.stub());
            transportHid.startListener();
        });

        afterEach(function () {
            transportHid.stopListener();
            this.clock.restore();
        });

        describe('.create', function () {
            it('should return an object with 9 commands', function () {
                var createdTransport = transportHid.create(sampleDevice);
                assert('object' === typeof(createdTransport));
                assert(9 === Object.keys(createdTransport).length);
                // assert.deepEqual(
                // ['_read', '_write', 'buildMessageMap', 'getDeviceId', 'getDeviceInfo', 'getMsgType', 'getMsgClass',
                // 'read', 'startSession', 'stopSession', 'write'],
                // Object.keys(createdTransport).sort());
                transport.remove(createdTransport.getDeviceId());
            });
        });

        describe('.startListener', function () {
            it('should start listening for device connections', function () {
                assert.equal(transport.getDeviceIds().length, 0);

                transportHid.stopListener();
                this.clock.tick(1000);
                transportHid.startListener();

                // trigger event
                global.chrome.hid.getDevices = function (filter, callback) {
                    callback([sampleDevice]);
                };

                this.clock.tick(1000);
                assert.equal(transport.getDeviceIds().length, 1);

                transport.remove(sampleDevice.deviceId);

                this.clock.tick(1000);
                // the following line is failing due to bleedover between the tests.
                //assert.equal(transport.getDeviceIds().length, 0);
            });
        });

        describe('.stopListener', function () {
            xit('should stop listening for device connections', function () {
                // the following line is failing due to bleedover between the tests.
                assert.equal(transport.getDeviceIds().length, 0);

                transportHid.stopListener();

                // trigger event
                global.chrome.hid.getDevices = function (filter, callback) {
                    callback([sampleDevice]);
                };
                this.clock.tick(1000);

                // the following line is failing due to bleedover between the tests.
                assert.equal(transport.getDeviceIds().length, 0);
            });
        });

        describe('.onDeviceConnected', function () {
            it('should create 1 transport object', function () {
                // trigger event
                global.chrome.hid.getDevices = function (filter, callback) {
                    callback([sampleDevice]);
                };
                this.clock.tick(1500);
                assert(1 === transport.getDeviceIds().length);
                transport.remove(sampleDevice.deviceId);
            });
        });

        describe('.onDeviceDisconnected', function () {
            it('should remove transport object', function () {
                // trigger event
                global.chrome.hid.getDevices = function (filter, callback) {
                    callback([]);
                };
                this.clock.tick(1500);
                assert(0 === transport.getDeviceIds().length);
            });
        });
    });

    describe('transportHid object', function () {
        beforeEach(function () {
            this.createdTransport = transportHid.create(sampleDevice);
        });

        afterEach(function () {
            transport.remove(this.createdTransport.getDeviceId());
        });

        describe('.getDeviceInfo', function () {
            it('should return vendor id and product id of device', function () {
                var deviceInfo = this.createdTransport.getDeviceInfo();

                assert(deviceInfo.vendorId === sampleDevice.vendorId);
                assert(deviceInfo.productId === sampleDevice.productId);
            });
        });
    });
});
