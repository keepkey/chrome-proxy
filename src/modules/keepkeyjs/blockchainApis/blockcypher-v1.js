var _ = require('lodash');
var walletNodeService = require('../services/walletNodeService.js');

const SPENT = -1;
const RECEIVED = 1;

const API_KEY = 'd9a5e85023faa87914a191f6a741a2c4';
const API_ROOT = 'https://api.blockcypher.com/v1/btc/main';
const SEND_RAW_TRANSACTION_PATH = 'txs/push';
const ADDRESS_API_PATH = 'addrs';
const GET_TRANSACTIONS_PATH = 'full';
const ADDRESS_JOIN_CHAR = ';';
const MAX_ADDRESSES_PER_REQUEST = 50;

function sendTransactionUri() {
  return [
    API_ROOT,
    SEND_RAW_TRANSACTION_PATH
  ].join('/');
}

function sendTransactionUrl() {
  return [
    sendTransactionUri(),
    'token=' + API_KEY
  ].join('?');
}

function getTransactionUri(walletAddresses) {
  return [
    API_ROOT,
    ADDRESS_API_PATH,
    walletAddresses.join(ADDRESS_JOIN_CHAR),
    GET_TRANSACTIONS_PATH
  ].join('/');
}

function getTransactionQueryString() {
  return [
    'token=' + API_KEY,
    'limit=50'
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
    "tx": rawtransaction.toHex()
  };
}

function convertTransactionToLocalFormat(transaction, index, matches, type, fragment) {
  return {
    transactionHash: transaction.hash,
    fragmentIndex: index,
    address: (matches.length === 1) ? matches[0] : matches,
    nodePath: walletNodeService.addressNodePath(matches[0]),
    type: type,
    amount: (type === SPENT) ? -fragment.output_value : fragment.value,
    transaction: transaction,
    confirmations: transaction.confirmations,
    spent: !!fragment.spent_by
  };
}

function processResults(data, walletAddresses, processTransactionFragmentFactory) {
  _.each(data, function (addressObject) {
    _.each(addressObject.txs, function (transaction) {
      var processTransactionInput = processTransactionFragmentFactory(walletAddresses, SPENT, transaction);
      var processTransactionOutput = processTransactionFragmentFactory(walletAddresses, RECEIVED, transaction);
      _.each(transaction.inputs, processTransactionInput);
      _.each(transaction.outputs, processTransactionOutput);
    });
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