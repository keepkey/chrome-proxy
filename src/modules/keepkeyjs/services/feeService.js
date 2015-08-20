var transactionService = require('../transactionService.js');
var httpClient = require('../HttpClient.js');
var _ = require('lodash');

const THROTTLE_INTERVAL = 10 * 1000;
const FEE_URL = "http://api.blockcypher.com/v1/btc/main";
const MAX_INPUT_SIZE = 149;
const OUTPUT_SIZE = 34;
const TRANSACTION_OVERHEAD_SIZE = 10;
const DUST = 546;

var fees = {};

var load = _.throttle(
  function load() {
    return httpClient.get(FEE_URL)
      .then(function (data) {
        fees.fast = data.high_fee_per_kb;
        fees.medium = data.medium_fee_per_kb;
        fees.slow = data.low_fee_per_kb;
        return fees;
      }
    );
  }, THROTTLE_INTERVAL, {
    trailing: false
  });

function computeFee(inCount, outCount, feeLevel) {
  return computeFeeWithTransactionSizer(
    inCount, outCount, feeLevel, computeTransactionSize);
}

function computeFeeDifferential(inCount, outCount, feeLevel) {
  return computeFeeWithTransactionSizer(
    inCount, outCount, feeLevel, computeTransactionSizeDifferential);
}

function computeFeeWithTransactionSizer(inCount, outCount, feeLevel, transactionSizer) {
  var transactionSize = transactionSizer(inCount, outCount);
  var feeRate = fees[feeLevel];
  return Math.ceil(transactionSize * feeRate);
}

function computeTransactionSize(inCount, outCount) {
  return (inCount * MAX_INPUT_SIZE + outCount * OUTPUT_SIZE + TRANSACTION_OVERHEAD_SIZE) / 1000;
}

function computeTransactionSizeDifferential(inCount, outCount) {
  return (inCount * MAX_INPUT_SIZE + outCount * OUTPUT_SIZE) / 1000;
}

function needMoreInputs(amount, inputCount, inputAmount, feeLevel, effectiveDust) {
  if (inputCount === 0) {
    return true;
  }
  var feeWithoutChange = computeFee(inputCount, 1, feeLevel);

  if (inputAmount - (amount + feeWithoutChange) < 0) {
    return true;
  } else if (inputAmount - (amount + feeWithoutChange) <= effectiveDust) {
    return false;
  } else {
    var feeWithChange = computeFee(inputCount, 2, feeLevel);
    var change = inputAmount - (amount + feeWithChange);
    var changeIsDust = change < DUST;
    var costToAddInput = computeFeeDifferential(1, 0, feeLevel);

    return changeIsDust && (costToAddInput < change);
  }
}

function estimateFee(walletNode, amount, feeLevel) {
  if (amount === 0) {
    return Promise.resolve(0);
  } else {
    return new Promise(function(resolve) {
      var selectedInputCount = 0;
      var selectedInputTotal = 0;
      var input;
      var estimatedFee;

      var ranOutOfInputs = false;

      // It isn't worth recovering change if it is below the fee for the added output
      var effectiveDust = Math.max(DUST, computeFeeDifferential(0, 1, feeLevel));

      transactionService.clearSelectedTransactions();

      while (needMoreInputs(amount, selectedInputCount, selectedInputTotal, feeLevel, effectiveDust)) {
        input = transactionService.getOldestUnspentAfter(walletNode, input);
        if (input) {
          transactionService.select(input.id);
          selectedInputCount++;
          selectedInputTotal += input.amount;
        } else {
          // when we run out of inputs, we can continue, but might give dust as a fee
          var feeWithOutChange = computeFee(selectedInputCount, 1, feeLevel);
          ranOutOfInputs = selectedInputTotal < amount + feeWithOutChange;

          break;
        }
      }

      if (ranOutOfInputs) {
        estimatedFee = undefined;
        transactionService.clearSelectedTransactions();
      } else if ((selectedInputTotal - amount) < (computeFee(selectedInputCount, 2, feeLevel) + DUST)) {
        // Close enough, no change required
        estimatedFee = selectedInputTotal - amount;
      } else {
        estimatedFee = computeFee(selectedInputCount, 2, feeLevel);
        if (selectedInputTotal - (amount + estimatedFee) < DUST) {
          console.error('this should not happen');
        }
      }

      resolve(estimatedFee);
    });
  }
}

function getMaximumTransactionAmount(walletNode, feeLevel) {
  return new Promise(function(resolve) {
    var inputs = transactionService.getTransactionsByNode(walletNode);
    var inputTotal = _.reduce(inputs, function(total, transaction) {
      return total + transaction.amount;
    }, 0);

    var fee = computeFee(inputs.length, 1, feeLevel);

    resolve(inputTotal - fee);
  });
}

module.exports = {
  getPromise: load,
  estimateFee: estimateFee,
  getMaximumTransactionAmount: getMaximumTransactionAmount
};

