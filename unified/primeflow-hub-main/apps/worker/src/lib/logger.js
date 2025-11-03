"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
var pino_1 = require("pino");
var env_js_1 = require("../config/env.js");
exports.logger = (0, pino_1.default)({
    level: env_js_1.env.LOG_LEVEL,
    transport: env_js_1.env.NODE_ENV === 'development' ? {
        target: 'pino-pretty',
        options: {
            colorize: true,
            ignore: 'pid,hostname',
            translateTime: 'SYS:standard'
        }
    } : undefined
});
