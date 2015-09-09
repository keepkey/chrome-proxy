var bunyan = require('bunyan');
var config = require('../dist/config.json');
var isNode = typeof window === "undefined";

function FormattedConsoleLog() {}
FormattedConsoleLog.prototype.write = function (rec) {
    console.log('[%s] %s: %s',
        rec.time.toISOString(),
        bunyan.nameFromLevel[rec.level],
        rec.msg);
};

var stream = new FormattedConsoleLog();

var logger = bunyan.createLogger({
    name: 'console',
    streams: [{
        level: 'warn',
        stream: stream,
        type: 'raw'
    }]
});

if (isNode) {
    if (config.cliLogLevel) {
        logger.levels(0, config.cliLogLevel);
    }
} else {
    if (config.chromeLogLevel) {
        logger.levels(0, config.chromeLogLevel);
    }
}

module.exports = logger;

