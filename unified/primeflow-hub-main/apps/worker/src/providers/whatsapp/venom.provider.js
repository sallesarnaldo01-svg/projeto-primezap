"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.venomProvider = exports.VenomProvider = void 0;
var venom_bot_1 = require("venom-bot");
var types_1 = require("@primeflow/shared/types");
var logger_js_1 = require("../../lib/logger.js");
var prisma_js_1 = require("../../lib/prisma.js");
var events_1 = require("events");
var redis_js_1 = require("../../lib/redis.js");
var VenomProvider = /** @class */ (function () {
    function VenomProvider() {
        this.type = types_1.ConnectionType.WHATSAPP;
        this.clients = new Map();
        this.messageCallbacks = [];
        this.qrEmitter = new events_1.EventEmitter();
    }
    VenomProvider.prototype.connect = function (connectionId, config) {
        return __awaiter(this, void 0, void 0, function () {
            var existingConnection, latestMeta_1, client, hostDevice, error_1, error_2;
            var _this = this;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (this.clients.has(connectionId)) {
                            logger_js_1.logger.warn('Venom connection already exists', { connectionId: connectionId });
                            return [2 /*return*/];
                        }
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 11, , 13]);
                        logger_js_1.logger.info('Starting Venom connection', { connectionId: connectionId });
                        return [4 /*yield*/, prisma_js_1.prisma.connection.findUnique({
                                where: { id: connectionId },
                                select: { meta: true }
                            })];
                    case 2:
                        existingConnection = _c.sent();
                        latestMeta_1 = __assign({}, ((_a = existingConnection === null || existingConnection === void 0 ? void 0 : existingConnection.meta) !== null && _a !== void 0 ? _a : {}));
                        return [4 /*yield*/, prisma_js_1.prisma.connection.update({
                                where: { id: connectionId },
                                data: { status: 'CONNECTING' }
                            }).catch(function (error) {
                                logger_js_1.logger.warn('Failed to mark connection as CONNECTING', { connectionId: connectionId, error: error });
                            })];
                    case 3:
                        _c.sent();
                        return [4 /*yield*/, venom_bot_1.default.create(connectionId, function (base64Qr) { return __awaiter(_this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            logger_js_1.logger.info('QR Code generated', { connectionId: connectionId });
                                            this.qrEmitter.emit("qr:".concat(connectionId), base64Qr);
                                            // Update connection with QR code
                                            latestMeta_1 = __assign(__assign({}, latestMeta_1), { qrCode: base64Qr });
                                            prisma_js_1.prisma.connection.update({
                                                where: { id: connectionId },
                                                data: {
                                                    status: 'CONNECTING',
                                                    meta: latestMeta_1
                                                }
                                            }).catch(function (err) { return logger_js_1.logger.error('Failed to update QR', { error: err }); });
                                            return [4 /*yield*/, redis_js_1.redis.setex("qr:".concat(connectionId), 120, base64Qr).catch(function (error) {
                                                    logger_js_1.logger.error('Failed to cache QR code in Redis', { connectionId: connectionId, error: error });
                                                })];
                                        case 1:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            }); }, function (statusSession) {
                                logger_js_1.logger.info('Session status', { connectionId: connectionId, status: statusSession });
                            }, {
                                headless: true,
                                useChrome: false,
                                debug: false,
                                logQR: false,
                                browserArgs: [
                                    '--no-sandbox',
                                    '--disable-setuid-sandbox',
                                    '--disable-dev-shm-usage',
                                    '--disable-accelerated-2d-canvas',
                                    '--no-first-run',
                                    '--no-zygote',
                                    '--disable-gpu'
                                ],
                                autoClose: 60000,
                                disableSpins: true,
                            })];
                    case 4:
                        client = _c.sent();
                        hostDevice = null;
                        _c.label = 5;
                    case 5:
                        _c.trys.push([5, 7, , 8]);
                        return [4 /*yield*/, client.getHostDevice()];
                    case 6:
                        hostDevice = _c.sent();
                        return [3 /*break*/, 8];
                    case 7:
                        error_1 = _c.sent();
                        logger_js_1.logger.warn('Failed to retrieve host device information', { connectionId: connectionId, error: error_1 });
                        return [3 /*break*/, 8];
                    case 8:
                        latestMeta_1 = __assign(__assign({}, latestMeta_1), { phone: (_b = hostDevice === null || hostDevice === void 0 ? void 0 : hostDevice.id) === null || _b === void 0 ? void 0 : _b.user, device: hostDevice === null || hostDevice === void 0 ? void 0 : hostDevice.platform });
                        if ('qrCode' in latestMeta_1) {
                            delete latestMeta_1.qrCode;
                        }
                        return [4 /*yield*/, prisma_js_1.prisma.connection.update({
                                where: { id: connectionId },
                                data: {
                                    status: 'CONNECTED',
                                    meta: latestMeta_1
                                }
                            })];
                    case 9:
                        _c.sent();
                        return [4 /*yield*/, redis_js_1.redis.del("qr:".concat(connectionId)).catch(function (error) {
                                logger_js_1.logger.warn('Failed to delete cached QR code', { connectionId: connectionId, error: error });
                            })];
                    case 10:
                        _c.sent();
                        logger_js_1.logger.info('Venom WhatsApp connected', { connectionId: connectionId });
                        // Listen for incoming messages
                        client.onMessage(function (message) {
                            if (message.isGroupMsg)
                                return;
                            if (message.fromMe)
                                return;
                            var content = {};
                            if (message.type === 'chat') {
                                content.text = message.body;
                            }
                            else if (message.type === 'image') {
                                content.image = {
                                    url: message.body,
                                    caption: message.caption
                                };
                            }
                            else if (message.type === 'audio' || message.type === 'ptt') {
                                content.audio = {
                                    url: message.body,
                                    ptt: message.type === 'ptt'
                                };
                            }
                            else if (message.type === 'video') {
                                content.video = {
                                    url: message.body,
                                    caption: message.caption
                                };
                            }
                            else if (message.type === 'document') {
                                content.document = {
                                    url: message.body,
                                    filename: message.filename
                                };
                            }
                            _this.messageCallbacks.forEach(function (cb) { return cb({
                                connectionId: connectionId,
                                from: message.from,
                                content: content,
                                timestamp: new Date(message.timestamp * 1000)
                            }); });
                        });
                        this.clients.set(connectionId, client);
                        return [3 /*break*/, 13];
                    case 11:
                        error_2 = _c.sent();
                        logger_js_1.logger.error('Failed to connect Venom', { connectionId: connectionId, error: error_2 });
                        return [4 /*yield*/, prisma_js_1.prisma.connection.update({
                                where: { id: connectionId },
                                data: { status: 'ERROR' }
                            }).catch(function () { })];
                    case 12:
                        _c.sent();
                        throw error_2;
                    case 13: return [2 /*return*/];
                }
            });
        });
    };
    VenomProvider.prototype.disconnect = function (connectionId) {
        return __awaiter(this, void 0, void 0, function () {
            var client;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        client = this.clients.get(connectionId);
                        if (!client) return [3 /*break*/, 4];
                        return [4 /*yield*/, client.close()];
                    case 1:
                        _a.sent();
                        this.clients.delete(connectionId);
                        return [4 /*yield*/, prisma_js_1.prisma.connection.update({
                                where: { id: connectionId },
                                data: { status: 'DISCONNECTED' }
                            })];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, redis_js_1.redis.del("qr:".concat(connectionId)).catch(function (error) {
                                logger_js_1.logger.warn('Failed to delete cached QR code on disconnect', { connectionId: connectionId, error: error });
                            })];
                    case 3:
                        _a.sent();
                        logger_js_1.logger.info('Venom WhatsApp disconnected', { connectionId: connectionId });
                        _a.label = 4;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    VenomProvider.prototype.isConnected = function (connectionId) {
        return __awaiter(this, void 0, void 0, function () {
            var client, state, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        client = this.clients.get(connectionId);
                        if (!client)
                            return [2 /*return*/, false];
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, client.getConnectionState()];
                    case 2:
                        state = _b.sent();
                        return [2 /*return*/, state === 'CONNECTED'];
                    case 3:
                        _a = _b.sent();
                        return [2 /*return*/, false];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    VenomProvider.prototype.sendMessage = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var client, chatId, result, messageId, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        client = this.clients.get(options.connectionId);
                        if (!client) {
                            throw new Error('Connection not found');
                        }
                        chatId = buildChatId(options.to);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 15, , 16]);
                        if (!options.content.text) return [3 /*break*/, 3];
                        return [4 /*yield*/, client.sendText(chatId, options.content.text)];
                    case 2:
                        result = _a.sent();
                        return [3 /*break*/, 14];
                    case 3:
                        if (!options.content.image) return [3 /*break*/, 5];
                        return [4 /*yield*/, client.sendImage(chatId, options.content.image.url, 'image', options.content.image.caption || '')];
                    case 4:
                        result = _a.sent();
                        return [3 /*break*/, 14];
                    case 5:
                        if (!options.content.audio) return [3 /*break*/, 7];
                        return [4 /*yield*/, client.sendVoice(chatId, options.content.audio.url)];
                    case 6:
                        result = _a.sent();
                        return [3 /*break*/, 14];
                    case 7:
                        if (!options.content.video) return [3 /*break*/, 9];
                        return [4 /*yield*/, client.sendVideoAsGif(chatId, options.content.video.url, 'video', options.content.video.caption || '')];
                    case 8:
                        result = _a.sent();
                        return [3 /*break*/, 14];
                    case 9:
                        if (!options.content.document) return [3 /*break*/, 11];
                        return [4 /*yield*/, client.sendFile(chatId, options.content.document.url, options.content.document.filename || 'document', '')];
                    case 10:
                        result = _a.sent();
                        return [3 /*break*/, 14];
                    case 11:
                        if (!options.content.buttons) return [3 /*break*/, 13];
                        return [4 /*yield*/, client.sendText(chatId, options.content.text || 'Escolha uma opção:')];
                    case 12:
                        result = _a.sent();
                        return [3 /*break*/, 14];
                    case 13: throw new Error('No content to send');
                    case 14:
                        messageId = extractMessageId(result);
                        logger_js_1.logger.info('Message sent via Venom', { connectionId: options.connectionId, to: chatId, messageId: messageId });
                        return [2 /*return*/, { messageId: messageId }];
                    case 15:
                        error_3 = _a.sent();
                        logger_js_1.logger.error('Failed to send message', { error: error_3, connectionId: options.connectionId });
                        throw error_3;
                    case 16: return [2 /*return*/];
                }
            });
        });
    };
    VenomProvider.prototype.onMessage = function (callback) {
        this.messageCallbacks.push(callback);
    };
    VenomProvider.prototype.onQRCode = function (connectionId, callback) {
        this.qrEmitter.on("qr:".concat(connectionId), callback);
    };
    VenomProvider.prototype.removeQRListener = function (connectionId) {
        this.qrEmitter.removeAllListeners("qr:".concat(connectionId));
    };
    return VenomProvider;
}());
exports.VenomProvider = VenomProvider;
exports.venomProvider = new VenomProvider();
function buildChatId(raw) {
    if (!raw) {
        throw new Error('Recipient number is required');
    }
    var trimmed = raw.trim();
    if (trimmed.includes('@')) {
        return trimmed;
    }
    var digits = trimmed.replace(/\D/g, '');
    if (!digits) {
        throw new Error('Recipient number is invalid');
    }
    return "".concat(digits, "@c.us");
}
function extractMessageId(result) {
    var _a;
    if (!result) {
        return '';
    }
    if (typeof result === 'string') {
        return result;
    }
    return result.id || result.messageId || ((_a = result.key) === null || _a === void 0 ? void 0 : _a.id) || '';
}
