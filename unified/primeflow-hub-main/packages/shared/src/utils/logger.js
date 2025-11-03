export function createConsoleLogger() {
    return {
        debug: function (msg, meta) { return console.debug(msg, meta); },
        info: function (msg, meta) { return console.info(msg, meta); },
        warn: function (msg, meta) { return console.warn(msg, meta); },
        error: function (msg, meta) { return console.error(msg, meta); }
    };
}
