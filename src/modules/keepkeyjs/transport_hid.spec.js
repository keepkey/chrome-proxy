(function () {

    'use strict';

    var assert = require('assert'),
        sinon = require('sinon'),
        transport = require('./transport.js'),
        transportHid = require('./transport_hid.js'),
        sampleDevice = {
            deviceId: 53,
            maxFeatureReportSize: 63,
            maxInputReportSize: 63,
            maxOutputReportSize: 63,
            productId: 1,
            vendorId: 11044
        };

    global.chrome = {
        hid: {
            getDevices: function () {
            },
            connect: function () {
            }
        }
    };

    describe('transportHid module', function () {

        beforeEach(function () {
            this.clock = sinon.useFakeTimers();

            transportHid.onDeviceConnected(function () {
            });
            transportHid.onDeviceDisconnected(function () {
            });
            transportHid.startListener();
        });

        afterEach(function () {
            transportHid.stopListener();
            this.clock.restore();

            // clear triggers
            global.chrome.hid.getDevices = function () {
            };
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
                transportHid.stopListener();
                transportHid.startListener();

                // trigger event
                global.chrome.hid.getDevices = function (filter, callback) {
                    callback([sampleDevice]);
                };
                this.clock.tick(1500);
                assert(1 === transport.getDeviceIds().length);
                transport.remove(sampleDevice.deviceId);
            });
        });

        describe('.stopListener', function () {
            it('should stop listening for device connections', function () {
                transportHid.stopListener();

                // trigger event
                global.chrome.hid.getDevices = function (filter, callback) {
                    callback([sampleDevice]);
                };
                this.clock.tick(1500);
                assert(0 === transport.getDeviceIds().length);
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

})();