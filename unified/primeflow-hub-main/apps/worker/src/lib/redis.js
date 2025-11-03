"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bullmqConnection = exports.redisSubscriber = exports.redis = void 0;
var ioredis_1 = require("ioredis");
var env_js_1 = require("../config/env.js");
var logger_js_1 = require("./logger.js");
var redisConfig = {
    host: env_js_1.env.REDIS_HOST,
    port: env_js_1.env.REDIS_PORT,
    maxRetriesPerRequest: null
};
exports.redis = new ioredis_1.default(redisConfig);
exports.redisSubscriber = new ioredis_1.default(redisConfig);
exports.bullmqConnection = redisConfig;
exports.redis.on('connect', function () {
    logger_js_1.logger.info('✅ Redis connected');
});
exports.redis.on('error', function (error) {
    logger_js_1.logger.error('❌ Redis error', { error: error });
});
exports.redisSubscriber.on('connect', function () {
    logger_js_1.logger.info('✅ Redis subscriber connected');
});
exports.redisSubscriber.on('error', function (error) {
    logger_js_1.logger.error('❌ Redis subscriber error', { error: error });
});
