module.exports = function(method, payload) {
    return window.crypto.subtle.digest(method, payload);
};