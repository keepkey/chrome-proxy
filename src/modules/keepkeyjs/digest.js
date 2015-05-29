module.exports = function() {
    return window.crypto.subtle.digest.apply(this, arguments);
};