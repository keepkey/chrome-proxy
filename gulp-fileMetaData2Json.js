var through = require('through2');
var gutil = require('gulp-util');
var PluginError = gutil.PluginError;
const PLUGIN_NAME = 'gulp-prefixer';
var crypto = require('crypto');

module.exports = function() {
    return through.obj(function(file, enc, callback) {
        if (file.isStream()) {
            this.emit('error', new PluginError(PLUGIN_NAME, 'Streams are not supported!'));
            return cb();
        }

        if (file.isBuffer()) {
            var fileHash = crypto.createHash('sha256');
            fileHash.update(file.contents);

            var fileHashTrezor = crypto.createHash('sha256');
            fileHashTrezor.update(file.contents.slice(256));

            var metaData = {
                file: file.relative,
                digest: fileHash.digest('hex'),
                trezorDigest: fileHashTrezor.digest('hex'),
                size: file.stat.size,
                timeStamp: file.stat.mtime
            }

            var prefix = new Buffer('module.exports=');
            var data = new Buffer(JSON.stringify(metaData));
            var postfix = new Buffer(';');

            file.path = gutil.replaceExtension(file.path, '.js');
            file.contents = Buffer.concat([prefix, data, postfix]);
        }


        callback(null, file);
    });
};