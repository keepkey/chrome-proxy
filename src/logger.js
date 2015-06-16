var bunyan = require('bunyan');

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

module.exports = logger;

