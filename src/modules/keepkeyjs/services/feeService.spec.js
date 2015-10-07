var proxyquire = require('proxyquire');
var chai = require('chai');
var sinon = require('sinon');
var _ = require('lodash');

const feeServicePath = './feeService.js';
const externalFeeServiceUrl = "http://api.blockcypher.com/v1/btc/main";
const mockBlockcypherMainResponse = {
  high_fee_per_kb: 40000,
  medium_fee_per_kb: 20000,
  low_fee_per_kb: 10000
};
const expectedFees = {
  fast: mockBlockcypherMainResponse.high_fee_per_kb,
  medium: mockBlockcypherMainResponse.medium_fee_per_kb,
  slow: mockBlockcypherMainResponse.low_fee_per_kb
};

// Constants from feeService.js
const MAX_INPUT_SIZE = 149;
const OUTPUT_SIZE = 34;
const TRANSACTION_OVERHEAD_SIZE = 10;
const DUST = 546;

describe('fee service', function() {
  var feeService;
  var mockHttpClient;
  var mockGet;
  var mockGetOldestUnspentAfter = sinon.stub();

  beforeEach(function() {
    mockGet = sinon.stub();
    mockHttpClient = proxyquire(feeServicePath, {
      '../HttpClient.js': {
        get: mockGet
          .returns(Promise.resolve(mockBlockcypherMainResponse))
      },
      './transactionService.js': {
        getOldestUnspentAfter: mockGetOldestUnspentAfter
      }
    });

    feeService = require(feeServicePath);

  });

  afterEach(function() {
    mockGetOldestUnspentAfter.reset();
  });

  describe('getPromise', function() {
    it('gets fees from blockcypher', function() {
      return feeService.getPromise()
        .then(function(fees) {
          chai.assert.ok(mockGet.calledOnce, 'httpClient not called once');
          chai.assert.ok(mockGet.calledWith(externalFeeServiceUrl), 'httpClient not called with the expected url');
          chai.assert.deepEqual(fees, expectedFees);
        });
    });
    it('throttles requests to blockcypher');
  });

  describe('estimateFee', function() {
    beforeEach(function() {
      return feeService.getPromise();
    });

    it('returns a promise', function() {
      var result = feeService.estimateFee({}, 1, 'fast');
      chai.assert.instanceOf(result, Promise);
    });

    it('resolves with 0 when the amount is 0', function() {
      return feeService.estimateFee({}, 0, 'fast')
        .then(function(result) {
          chai.assert.equal(result, 0);
        });
    });

    it('resolves with undefined when not enough inputs are available', function() {
      var transactionAmount = 100000;
      var minimumFee = expectedFees.fast *
        (MAX_INPUT_SIZE + OUTPUT_SIZE + TRANSACTION_OVERHEAD_SIZE) / 1000;

      mockGetOldestUnspentAfter
        .onCall(0).returns({value: transactionAmount + minimumFee - 1})
        .onCall(1).returns(undefined);

      return feeService.estimateFee({}, transactionAmount, 'fast')
        .then(function(calculatedFee) {
          chai.assert.equal(calculatedFee, undefined);
        });
    });

    it('resolves with the minimum fee when the maximum amount is sent', function() {
      var transactionAmount = 100000;
      var minimumFee = expectedFees.fast *
        (MAX_INPUT_SIZE + OUTPUT_SIZE + TRANSACTION_OVERHEAD_SIZE) / 1000;

      mockGetOldestUnspentAfter
        .onCall(0).returns({value: transactionAmount + minimumFee})
        .onCall(1).returns(undefined);

      return feeService.estimateFee({}, transactionAmount, 'fast')
        .then(function(calculatedFee) {
          chai.assert.equal(calculatedFee, minimumFee);
        });
    });

    it('resolves with the unused input when adding change would cause the amount and fee to exceed the input', function() {
      var transactionAmount = 100000;
      var minimumFee = expectedFees.fast *
        (MAX_INPUT_SIZE + OUTPUT_SIZE + TRANSACTION_OVERHEAD_SIZE) / 1000;

      mockGetOldestUnspentAfter
        .onCall(0).returns({value: transactionAmount + minimumFee + 1})
        .onCall(1).returns(undefined);

      return feeService.estimateFee({}, transactionAmount, 'fast')
        .then(function(calculatedFee) {
          chai.assert.equal(calculatedFee, minimumFee + 1);
        });
    });

    it('resolves with the unused input when the change would increase fee more than the amount of change', function() {
      var transactionAmount = 100000;
      var minimumFee = expectedFees.fast *
        (MAX_INPUT_SIZE + OUTPUT_SIZE + TRANSACTION_OVERHEAD_SIZE) / 1000;
      var feeDifferential = expectedFees.fast * OUTPUT_SIZE / 1000;

      mockGetOldestUnspentAfter
        .onCall(0).returns({value: transactionAmount + minimumFee + feeDifferential})
        .onCall(1).returns(undefined);

      return feeService.estimateFee({}, transactionAmount, 'fast')
        .then(function(calculatedFee) {
          chai.assert.equal(calculatedFee, minimumFee + feeDifferential);
        });
    });

    it('resolves with the unused input when the change would be dust', function() {
      var transactionAmount = 100000;
      var minimumFee = expectedFees.fast *
        (MAX_INPUT_SIZE + 2 * OUTPUT_SIZE + TRANSACTION_OVERHEAD_SIZE) / 1000;

      mockGetOldestUnspentAfter
        .onCall(0).returns({value: transactionAmount + minimumFee + DUST - 1})
        .onCall(1).returns(undefined);

      return feeService.estimateFee({}, transactionAmount, 'fast')
        .then(function(calculatedFee) {
          chai.assert.equal(calculatedFee, minimumFee + DUST - 1);
        });
    });

    it('resolves with the minimum fee when the change is over the dust threshhold', function() {
      var transactionAmount = 100000;
      var minimumFee = expectedFees.fast *
        (MAX_INPUT_SIZE + 2 * OUTPUT_SIZE + TRANSACTION_OVERHEAD_SIZE) / 1000;

      mockGetOldestUnspentAfter
        .onCall(0).returns({value: transactionAmount + minimumFee + DUST})
        .onCall(1).returns(undefined);

      return feeService.estimateFee({}, transactionAmount, 'fast')
        .then(function(calculatedFee) {
          chai.assert.equal(calculatedFee, minimumFee);
        });
    });

    it('includes a second transaction when the first is too small', function() {
      var transactionAmount = 100000;
      var minimumFee = expectedFees.fast *
        (MAX_INPUT_SIZE + OUTPUT_SIZE + TRANSACTION_OVERHEAD_SIZE) / 1000;
      var differential = expectedFees.fast * (MAX_INPUT_SIZE + OUTPUT_SIZE) / 1000;

      mockGetOldestUnspentAfter
        .onCall(0).returns({value: transactionAmount + minimumFee - 1})
        .onCall(1).returns({value: transactionAmount})
        .onCall(2).returns(undefined);

      return feeService.estimateFee({}, transactionAmount, 'fast')
        .then(function(calculatedFee) {
          chai.assert.equal(calculatedFee, minimumFee + differential);
        });
    });

    it('Adds small leftover amounts to the fee to avoid higher fee due to increased transaction size', function() {
      var transactionAmount = 100000;
      var minimumFee = expectedFees.fast *
        (MAX_INPUT_SIZE + OUTPUT_SIZE + TRANSACTION_OVERHEAD_SIZE) / 1000;
      var differential = expectedFees.fast * (MAX_INPUT_SIZE) / 1000;
      var changeDifferential = expectedFees.fast * (OUTPUT_SIZE) / 1000;

      mockGetOldestUnspentAfter
        .onCall(0).returns({value: transactionAmount + minimumFee - 1})
        .onCall(1).returns({value: differential + changeDifferential + DUST})
        .onCall(2).returns(undefined);

      return feeService.estimateFee({}, transactionAmount, 'fast')
        .then(function(calculatedFee) {
          chai.assert.equal(calculatedFee,
            minimumFee + differential + changeDifferential + DUST - 1);
        });
    });


  });
});