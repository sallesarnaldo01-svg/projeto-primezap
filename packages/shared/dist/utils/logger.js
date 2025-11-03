export function createConsoleLogger() {
    return {
        debug: (msg, meta) => console.debug(msg, meta),
        info: (msg, meta) => console.info(msg, meta),
        warn: (msg, meta) => console.warn(msg, meta),
        error: (msg, meta) => console.error(msg, meta)
    };
}
