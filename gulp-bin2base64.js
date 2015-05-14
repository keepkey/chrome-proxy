var through = require('through2');
var gutil = require('gulp-util');
var PluginError = gutil.PluginError;
const PLUGIN_NAME = 'gulp-prefixer';

module.exports = function() {
    return through.obj(function(file, enc, callback) {
        if (file.isStream()) {
            this.emit('error', new PluginError(PLUGIN_NAME, 'Streams are not supported!'));
            return cb();
        }

        if (file.isBuffer()) {
            var prefix = new Buffer('export.modules="');
            var postfix = new Buffer('";');
            var contents = new Buffer(file.contents.toString('base64'));
            file.contents = Buffer.concat([prefix, contents, postfix]);
        }

        file.path = gutil.replaceExtension(file.path, '.js');

        callback(null, file);
    });
};