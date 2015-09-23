var _ = require('lodash');
var walletNodeService = require('../services/walletNodeService.js');

const SPENT = -1;
const RECEIVED = 1;

const CHAIN_API_KEY = 'bae5d67396c223d643b574df299225ba';
const CHAIN_API_ROOT = 'https://api.chain.com/v2/bitcoin';
const CHAIN_SEND_RAW_TRANSACTION_PATH = 'transactions/send';
const CHAIN_ADDRESS_API_PATH = 'addresses';
const CHAIN_GET_TRANSACTIONS_PATH = 'transactions';
const CHAIN_ADDRESS_JOIN_CHAR = ',';
const MAX_ADDRESSES_PER_REQUEST = 200;
const TRANSACTION_PAGE_SIZE = 500;

function sendTransactionUri() {
  return [
    CHAIN_API_ROOT,
    CHAIN_SEND_RAW_TRANSACTION_PATH
  ].join('/');
}

function sendTransactionUrl() {
  return [
    sendTransactionUri(),
    'api-key-id=' + CHAIN_API_KEY
  ].join('?');
}

function getTransactionUri(walletAddresses) {
  return [
    CHAIN_API_ROOT,
    CHAIN_ADDRESS_API_PATH,
    walletAddresses.join(CHAIN_ADDRESS_JOIN_CHAR),
    CHAIN_GET_TRANSACTIONS_PATH
  ].join('/');
}

function getTransactionQueryString() {
  return [
    'api-key-id=' + CHAIN_API_KEY,
    'limit=' + TRANSACTION_PAGE_SIZE
  ].join('&');
}

function getTransactionsUrl(walletAddresses) {
  return [
    getTransactionUri(walletAddresses),
    getTransactionQueryString()
  ].join('?');
}

function sendTransactionPayload(rawtransaction) {
  return {
    "signed_hex": rawtransaction.toHex()
  };
}

function convertTransactionToLocalFormat(transaction, index, matches, type, fragment) {
  return {
    transactionHash: transaction.hash,
    fragmentIndex: index,
    address: (matches.length === 1) ? matches[0] : matches,
    nodePath: walletNodeService.addressNodePath(matches[0]),
    type: type,
    amount: (type === SPENT) ? -fragment.value : fragment.value,
    transaction: transaction,
    confirmations: transaction.confirmations,
    spent: fragment.spent
  };
}

function processResults(data, walletAddresses, processTransactionFragmentFactory) {
  _.each(data, function processTransaction(transaction) {
    var processTransactionInput = processTransactionFragmentFactory(walletAddresses, SPENT, transaction);
    var processTransactionOutput = processTransactionFragmentFactory(walletAddresses, RECEIVED, transaction);

    _.each(transaction.inputs, processTransactionInput);
    _.each(transaction.outputs, processTransactionOutput);
  });
}


module.exports = {
  sendTransactionUrl: sendTransactionUrl,
  getTransactionsUrl: getTransactionsUrl,
  sendTransactionPayload: sendTransactionPayload,
  maxAddressesPerRequest: MAX_ADDRESSES_PER_REQUEST,
  convertTransactionToLocalFormat: convertTransactionToLocalFormat,
  processResults: processResults
};