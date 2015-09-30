var ByteBuffer = require('bytebuffer');
var _ = require('lodash');

var featuresService = require('../featuresService.js');
var feeService = require('../services/feeService.js');

var transactionService = require('../services/transactionService.js');
var transactions = transactionService.transactions;

var walletNodeService = require('../services/walletNodeService.js');
var nodePathHelper = require('../nodePathHelper.js');

var client;

const SPENDADDRESS = 0;
const SPENDMULTISIG = 1;

const TXINPUT = 'TXINPUT';
const TXMETA = 'TXMETA';
const TXOUTPUT = 'TXOUTPUT';
const TXFINISHED = 'TXFINISHED';

const NOT_ENOUGH_BITCOINS_ERROR_MESSAGE = 'You do not have enough bitcoins';

var transactionSigner = {};
var newTransaction;

function createTransaction(request) {
  var sourceWallet = walletNodeService.findNodeById(request.sourceIndex);
  var fee, change;
  newTransaction = {
    walletNodeN: sourceWallet.hdNode,
    inputs: [],
    outputs: []
  };

  return feeService.getPromise()
    .then(function () {
      return feeService.estimateFee(sourceWallet.hdNode, request.amount, request.feeLevel);
    })
    .then(function (calculatedFee) {
      fee = calculatedFee;
      return transactionService.getSelectedTransactions();
    })
    .then(function (transactions) {
      newTransaction.inputs = transactions;
      var inputTotal = _.reduce(transactionService.selectedTransactions, function (total, transaction) {
        return total + transaction.value;
      }, 0);

      newTransaction.outputs.push({
        address: request.address,
        amount: request.amount
      });

      change = inputTotal - request.amount - fee;
      if (change < 0) {
        return Promise.reject(NOT_ENOUGH_BITCOINS_ERROR_MESSAGE);
      } else if (change > 0) {
        return walletNodeService.getUnusedChangeAddressNode()
          .then(function (changeAddressNode) {
            newTransaction.outputs.push({
              address_n: nodePathHelper.joinPaths(sourceWallet.hdNode, changeAddressNode.path),
              amount: change
            });
          });
      }
    })
    .then(function() {
      return newTransaction;
    });
}

var serializedTransaction;
var signatures;

transactionSigner.requestTransactionSignature = function requestTransactionSignature(request) {
  client = this;
  serializedTransaction = new ByteBuffer(0);
  signatures = [];

  return featuresService.getPromise()
    .then(function (features) {
      return createTransaction(request);
    })
    .then(function () {
      var message = new client.protoBuf.SignTx(
        newTransaction.outputs.length, newTransaction.inputs.length, 'Bitcoin');

      return client.writeToDevice(message);
    });
};

var defaultTxInputType = {
  address_n: [],
  prev_hash: null,
  prev_index: 0,
  script_sig: null,
  sequence: 0xffffffff,
  script_type: SPENDADDRESS
};

function convertScriptSigToBuffer(scriptSig) {
  var bits = scriptSig.split(' ');
  var str = bits[0] + bits[1].length.toString(16) + bits[1];
  return ByteBuffer.fromHex(str);
}

function transactionInputToPb(requestedInput) {
  return txInputTypeFactory(_.defaults({
    address_n: nodePathHelper.toVector(
      nodePathHelper.joinPaths(
        newTransaction.walletNodeN,
        requestedInput.hdNode
      )
    ),
    prev_hash: requestedInput.tx_hash ?
      ByteBuffer.fromHex(requestedInput.tx_hash) :
      ByteBuffer.fromHex(requestedInput.prev_hash),
    prev_index: typeof(requestedInput.output_index) === 'undefined' ?
      requestedInput.tx_output_n : requestedInput.output_index,
    script_sig: requestedInput.script ?
      ByteBuffer.fromHex(requestedInput.script) : null,
    sequence: requestedInput.sequence ? requestedInput.sequence : null
  }, defaultTxInputType));
}

function txInputTypeFactory(inputOptions) {
  return new client.protoBuf.TxInputType(
    inputOptions.address_n,
    inputOptions.prev_hash,
    inputOptions.prev_index,
    inputOptions.script_sig,
    inputOptions.sequence,
    inputOptions.script_type
  );
}

const PAYTOADDRESS = 0;
const PAYTOSCRIPTHASH = 1;
const PAYTOMULTISIG = 2;
const PAYTOOPRETURN = 3;

var defaultTxBinOutputType = {
  amount: 0,
  script_pubkey: null
};

function transactionOutputToBinPb(requestedOutput) {
  return txBinOutputTypeFactory(_.defaults({
    amount: requestedOutput.value,
    script_pubkey: ByteBuffer.fromHex(requestedOutput.script)
  }, defaultTxBinOutputType));
}

function txBinOutputTypeFactory(outputOptions) {
  return new client.protoBuf.TxOutputBinType(
    outputOptions.amount,
    outputOptions.script_pubkey
  );
}

var defaultTxOutputType = {
  address: null,
  address_n: [],
  amount: 0,
  script_type: PAYTOADDRESS
  //optional MultisigRedeemScriptType multisig = 5; // defines multisig address; script_type must be PAYTOMULTISIG
  //optional bytes op_return_data = 6;		// defines op_return data; script_type must be PAYTOOPRETURN, amount must be 0
};

function transactionOutputToPb(requestedOutput) {
  return txOutputTypeFactory(_.defaults({
    address: requestedOutput.address,
    address_n: nodePathHelper.toVector(requestedOutput.address_n),
    amount: requestedOutput.amount,
    script_type: requestedOutput.script_type
  }, defaultTxOutputType));
}

function txOutputTypeFactory(outputOptions) {
  return new client.protoBuf.TxOutputType(
    outputOptions.address,
    outputOptions.address_n,
    outputOptions.amount,
    outputOptions.script_type
  );
}

var defaultTransactionType = {
  version: null,
  inputs: null,
  bin_outputs: null,
  outputs: null,
  lock_time: null,
  inputs_cnt: null,
  outputs_cnt: null
};

function transactionTypeFactory(options) {
  return new client.protoBuf.TxAck(
    new client.protoBuf.TransactionType(
      options.version,
      options.inputs, /* TxInputType */
      options.bin_outputs, /* TxOutputBinType */
      options.outputs, /* TxOutputType */
      options.lock_time,
      options.inputs_cnt,
      options.outputs_cnt
    )
  );
}

transactionSigner.transactionRequestHandler = function transactionRequestHandler(request) {
  var options = _.defaults({}, defaultTransactionType);

  if (!client || !newTransaction) {
    throw('Error got TxRequest when no SignTx is active');
  }

  var transaction = (request.details && request.details.tx_hash) ?
    _.find(newTransaction.inputs, {tx_hash: request.details.tx_hash.toHex()}) :
    newTransaction;

  if (request.serialized && request.serialized.serialized_tx) {
    serializedTransaction = ByteBuffer.concat([serializedTransaction, request.serialized.serialized_tx]);
  }

  if (request.serialized && request.serialized.signature_index) {
    if (!signatures[request.signature_index]) {
      signatures[request.signature_index] = request.serialized.signature;
    }
  }

  if (request.request_type === TXINPUT) {
    options.inputs = [
      transactionInputToPb(transaction.inputs[request.details.request_index])
    ];
    return client.writeToDevice(transactionTypeFactory(options));
  }
  else if (request.request_type === TXMETA) {
    options.version = 1;
    options.lock_time = 0;
    options.inputs_cnt = transaction.inputs.length;
    options.outputs_cnt = transaction.outputs.length;
    return client.writeToDevice(transactionTypeFactory(options));
  }
  else if (request.request_type === TXOUTPUT) {
    var requestedOutput = transaction.outputs[request.details.request_index];
    if (request.details.tx_hash) {
      options.bin_outputs = [
        transactionOutputToBinPb(requestedOutput)
      ];
    } else {
      if (requestedOutput.address && requestedOutput.address.startsWith('3')) {
        requestedOutput.script_type = PAYTOSCRIPTHASH;
      }
      options.outputs = [
        transactionOutputToPb(requestedOutput)
      ];
    }
    return client.writeToDevice(transactionTypeFactory(options));
  }
  else if (request.request_type === TXFINISHED) {
    transactionService.sendTransaction(serializedTransaction)
      .then(function () {
        return new Promise(function (resolve) {
          setTimeout(function () {
            transactionService.reloadTransactions()
              .then(resolve);
          }, 3000);
        });
      });
  }
};

module.exports = transactionSigner;