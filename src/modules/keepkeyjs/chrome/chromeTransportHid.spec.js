describe('transportHidModule', function () {
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
        transport = require('./../transport.js');
        transportHid = require('./chromeTransportHid.js');
    });

    describe('transportHidModule module', function () {

        beforeEach(function () {
            this.clock = sinon.useFakeTimers();
        });

        afterEach(function () {
            this.clock.restore();
        });

        xdescribe('.create', function () {
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

        xdescribe('.startListener', function () {
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

        xdescribe('.stopListener', function () {
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

        describe('.onConnect', function () {
            var testDevice;
            var stubCallback;

            beforeEach(function() {
                testDevice = {deviceId: '987'};
                stubCallback = sinon.stub();

                sinon.stub(transport, 'create').returns(testDevice);

                transportHid.onConnect(testDevice, stubCallback);
            });

            afterEach(function() {
                transport.create.restore();
            });

            it('should create a transport object', function () {
                sinon.assert.calledOnce(transport.create);
                sinon.assert.calledWith(transport.create, testDevice.deviceId);
            });

            it('should decorate the transport object with 3 functions', function() {
                assert.isFunction(testDevice._write);
                assert.isFunction(testDevice._read);
                assert.isFunction(testDevice.getDeviceInfo);
            });

            it('the _write function should return a promise', function() {
                var returned = testDevice._write({
                    limit: 10,
                    toArrayBuffer: sinon.stub().returns(new ArrayBuffer(10))
                });

                assert.isFunction(returned.then);
            });

            xit('the _write function resolves to ???', function(done) {
                // TODO Make this test work and write more

                global.chrome.hid.send = sinon.stub().callsArg(3);

                testDevice._write({
                    limit: 10,
                    toArrayBuffer: sinon.stub().returns(new ArrayBuffer(10))
                }).then(function(result) {
                    assert.equal(result, 'foo');
                    done();
                });
            });
        });

        xdescribe('.onDeviceDisconnected', function () {
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

    xdescribe('transportHidModule object', function () {
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
