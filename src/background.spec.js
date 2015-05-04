/* globals sinon, assert, page, fs, chrome */

//////////////////
// Broken tests //
//////////////////

// These tests are disabled because I can't find a good way to write them. The confluence of Browserify, phantomjs and the
// inline execution of background.js are causing these tests to be difficult to write. I need a little time to allow a
// solution to simmer.


xdescribe('background', function () {
    this.timeout(4000);

    var clientModuleFactory;
    var clientModuleFind;
    var clientModuleRemove;

    var mockClient = {
        //getDeviceType: sinon.stub().returns('sonic screwdriver')
    };
    var mockApplicationId = 'tardis';
    //var config = require('../dist/config.json');
    var mockDeviceId = 42;

    var onConnectedStub;
    var onDisconnectedStub;

    // empty html page aka generated background page
    var FILENAME = 'src/testHarness/empty.html';


    //beforeEach(function () {
        //onConnectedStub = sinon.stub(transportHidModule, 'onDeviceConnected');
        //onDisconnectedStub = sinon.stub(transportHidModule, 'onDeviceDisconnected');
        ////
        ////global.chrome = require('chrome-mock');
        ////
        //clientModuleFactory = sinon.stub(clientModule, "factory").returns(mockClient);
        //clientModuleFind = sinon.stub(clientModule, "find").returns(mockClient);
        //clientModuleRemove = sinon.stub(clientModule, "remove");
        //
        //config.keepkeyWallet.applicationId = mockApplicationId;
        ////
        ////require('./background.js');
        //
        //var context = {
        //    chrome: chrome
        //};
        //
        //var code = fs.readFileSync('./src/background.js');
        //vm.runInNewContext(code, context);
    //});

    //afterEach(function () {
        //onConnectedStub.restore();
        //onDisconnectedStub.restore();
        //
        //clientModuleFactory.restore();
        //clientModuleFind.restore();
        //clientModuleRemove.restore();
    //});

    describe('device', function () {
        it('Sets up a listener for when devices are connected', function (done) {

            page.open(FILENAME, function () {


                //page.evaluate(function () {
                //    /* jshint -W117 */
                //    onConnectedStub = sinon.stub(transportHidModule, 'onDeviceConnected');
                //    /* jshint +W117 */
                //});

                // run background js
                //page.injectJs('src/background.js');

                page.evaluate(function () {
                    /* jshint -W117 */
                    console.log('checking connected stub');

                    //sinon.assert.callCount(onConnectedStub, 1);
                    /* jshint +W117 */
                });
                done();



            });
        });

        it('Sends a message to the wallet when device connected', function () {
            var connectionCallBack = onConnectedStub.args[0][0];

            var mockTransport = {
                getDeviceId: sinon.stub().returns(mockDeviceId)
            };

            connectionCallBack(mockTransport);

            sinon.assert.callCount(chrome.runtime.sendMessage, 1);

            var args = chrome.runtime.sendMessage.args[0];
            assert.equal(args[0], mockApplicationId);
            assert.deepEqual(args[1],
                {
                messageType: 'connected',
                deviceType: mockClient.getDeviceType(),
                deviceId: mockDeviceId
            });
        });

        it('Sends a message when device disconnected', function () {
            sinon.assert.callCount(onDisconnectedStub, 1);

            var callback = onDisconnectedStub.args[0][0];

            var mockTransport = {
                getDeviceId: sinon.stub().returns(mockDeviceId)
            };

            callback(mockTransport);

            sinon.assert.callCount(global.chrome.runtime.sendMessage, 1);

            var args = global.chrome.runtime.sendMessage.args[0];
            assert.equal(args[0], mockApplicationId);
            assert.deepEqual(args[1], {
                messageType: 'disconnected',
                deviceType: mockClient.getDeviceType(),
                deviceId: mockDeviceId
            });
        });

    });

});
