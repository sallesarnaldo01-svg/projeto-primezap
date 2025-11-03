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
exports.baileysProvider = exports.BaileysProvider = void 0;
var node_path_1 = require("node:path");
var node_fs_1 = require("node:fs");
var baileys_1 = require("@whiskeysockets/baileys");
var pino_1 = require("pino");
var types_1 = require("@primeflow/shared/types");
var logger_js_1 = require("../../lib/logger.js");
var prisma_js_1 = require("../../lib/prisma.js");
var redis_js_1 = require("../../lib/redis.js");
var BaileysProvider = /** @class */ (function () {
    function BaileysProvider() {
        this.type = types_1.ConnectionType.WHATSAPP;
        this.connections = new Map();
        this.messageCallbacks = [];
    }
    BaileysProvider.prototype.connect = function (connectionId, config) {
        return __awaiter(this, void 0, void 0, function () {
            var authRoot, authPath, existingConnection, latestMeta_1, _a, state, saveCreds, version, socket_1, error_1;
            var _this = this;
            var _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        if (this.connections.has(connectionId)) {
                            logger_js_1.logger.warn('Baileys connection already exists', { connectionId: connectionId });
                            return [2 /*return*/];
                        }
                        _d.label = 1;
                    case 1:
                        _d.trys.push([1, 6, , 8]);
                        authRoot = (_b = config === null || config === void 0 ? void 0 : config.authDir) !== null && _b !== void 0 ? _b : node_path_1.default.resolve('./.baileys-auth');
                        (0, node_fs_1.mkdirSync)(authRoot, { recursive: true });
                        authPath = node_path_1.default.join(authRoot, connectionId);
                        return [4 /*yield*/, prisma_js_1.prisma.connection.findUnique({
                                where: { id: connectionId },
                                select: { meta: true }
                            })];
                    case 2:
                        existingConnection = _d.sent();
                        latestMeta_1 = __assign({}, ((_c = existingConnection === null || existingConnection === void 0 ? void 0 : existingConnection.meta) !== null && _c !== void 0 ? _c : {}));
                        return [4 /*yield*/, prisma_js_1.prisma.connection.update({
                                where: { id: connectionId },
                                data: { status: 'CONNECTING' }
                            }).catch(function (error) {
                                logger_js_1.logger.warn('Failed to mark Baileys connection as CONNECTING', { connectionId: connectionId, error: error });
                            })];
                    case 3:
                        _d.sent();
                        return [4 /*yield*/, (0, baileys_1.useMultiFileAuthState)(authPath)];
                    case 4:
                        _a = _d.sent(), state = _a.state, saveCreds = _a.saveCreds;
                        return [4 /*yield*/, (0, baileys_1.fetchLatestBaileysVersion)()];
                    case 5:
                        version = (_d.sent()).version;
                        socket_1 = (0, baileys_1.default)({
                            version: version,
                            auth: state,
                            printQRInTerminal: false,
                            logger: (0, pino_1.default)({ level: 'error' }),
                            markOnlineOnConnect: false,
                            browser: ['Primeflow', 'Firefox', '1.0']
                        });
                        this.connections.set(connectionId, {
                            socket: socket_1,
                            meta: latestMeta_1
                        });
                        socket_1.ev.on('creds.update', saveCreds);
                        socket_1.ev.on('connection.update', function (update) { return __awaiter(_this, void 0, void 0, function () {
                            var connection, lastDisconnect, qr, hostJid, phone, statusCode, shouldReconnect;
                            var _this = this;
                            var _a, _b, _c, _d;
                            return __generator(this, function (_e) {
                                switch (_e.label) {
                                    case 0:
                                        connection = update.connection, lastDisconnect = update.lastDisconnect, qr = update.qr;
                                        if (!qr) return [3 /*break*/, 3];
                                        latestMeta_1 = __assign(__assign({}, latestMeta_1), { qrCode: qr });
                                        return [4 /*yield*/, prisma_js_1.prisma.connection.update({
                                                where: { id: connectionId },
                                                data: {
                                                    status: 'CONNECTING',
                                                    meta: latestMeta_1
                                                }
                                            }).catch(function (error) {
                                                logger_js_1.logger.error('Failed to store QR for Baileys connection', { connectionId: connectionId, error: error });
                                            })];
                                    case 1:
                                        _e.sent();
                                        return [4 /*yield*/, redis_js_1.redis.setex("qr:".concat(connectionId), 120, qr).catch(function (error) {
                                                logger_js_1.logger.error('Failed to cache Baileys QR code in Redis', { connectionId: connectionId, error: error });
                                            })];
                                    case 2:
                                        _e.sent();
                                        _e.label = 3;
                                    case 3:
                                        if (!(connection === 'open')) return [3 /*break*/, 6];
                                        hostJid = (_a = socket_1.authState.creds.me) === null || _a === void 0 ? void 0 : _a.id;
                                        phone = (_b = hostJid === null || hostJid === void 0 ? void 0 : hostJid.split(':')[0]) === null || _b === void 0 ? void 0 : _b.replace(/\D/g, '');
                                        latestMeta_1 = __assign(__assign({}, latestMeta_1), { phone: phone, device: 'Baileys' });
                                        if ('qrCode' in latestMeta_1) {
                                            delete latestMeta_1.qrCode;
                                        }
                                        return [4 /*yield*/, prisma_js_1.prisma.connection.update({
                                                where: { id: connectionId },
                                                data: {
                                                    status: 'CONNECTED',
                                                    meta: latestMeta_1
                                                }
                                            }).catch(function (error) {
                                                logger_js_1.logger.error('Failed to mark Baileys connection as CONNECTED', { connectionId: connectionId, error: error });
                                            })];
                                    case 4:
                                        _e.sent();
                                        return [4 /*yield*/, redis_js_1.redis.del("qr:".concat(connectionId)).catch(function (error) {
                                                logger_js_1.logger.warn('Failed to clear Baileys QR cache', { connectionId: connectionId, error: error });
                                            })];
                                    case 5:
                                        _e.sent();
                                        logger_js_1.logger.info('Baileys WhatsApp connected', { connectionId: connectionId });
                                        return [3 /*break*/, 9];
                                    case 6:
                                        if (!(connection === 'close')) return [3 /*break*/, 9];
                                        statusCode = (_d = (_c = lastDisconnect === null || lastDisconnect === void 0 ? void 0 : lastDisconnect.error) === null || _c === void 0 ? void 0 : _c.output) === null || _d === void 0 ? void 0 : _d.statusCode;
                                        shouldReconnect = statusCode !== baileys_1.DisconnectReason.loggedOut;
                                        logger_js_1.logger.warn('Baileys connection closed', { connectionId: connectionId, shouldReconnect: shouldReconnect, statusCode: statusCode });
                                        if (!!shouldReconnect) return [3 /*break*/, 8];
                                        this.connections.delete(connectionId);
                                        return [4 /*yield*/, prisma_js_1.prisma.connection.update({
                                                where: { id: connectionId },
                                                data: { status: 'DISCONNECTED' }
                                            }).catch(function (error) {
                                                logger_js_1.logger.warn('Failed to mark Baileys connection as DISCONNECTED', { connectionId: connectionId, error: error });
                                            })];
                                    case 7:
                                        _e.sent();
                                        return [3 /*break*/, 9];
                                    case 8:
                                        setTimeout(function () {
                                            _this.connect(connectionId, config).catch(function (error) {
                                                logger_js_1.logger.error('Failed to reconnect Baileys', { connectionId: connectionId, error: error });
                                            });
                                        }, 2000);
                                        _e.label = 9;
                                    case 9: return [2 /*return*/];
                                }
                            });
                        }); });
                        socket_1.ev.on('messages.upsert', function (_a) {
                            var _b, _c, _d;
                            var messages = _a.messages;
                            var _loop_1 = function (msg) {
                                if (msg.key.fromMe)
                                    return "continue";
                                var content = {};
                                if ((_b = msg.message) === null || _b === void 0 ? void 0 : _b.conversation) {
                                    content.text = msg.message.conversation;
                                }
                                else if ((_c = msg.message) === null || _c === void 0 ? void 0 : _c.extendedTextMessage) {
                                    content.text = msg.message.extendedTextMessage.text;
                                }
                                else if ((_d = msg.message) === null || _d === void 0 ? void 0 : _d.imageMessage) {
                                    content.image = {
                                        url: '', // TODO: implement media download
                                        caption: msg.message.imageMessage.caption
                                    };
                                }
                                _this.messageCallbacks.forEach(function (callback) {
                                    var _a;
                                    return callback({
                                        connectionId: connectionId,
                                        from: msg.key.remoteJid,
                                        content: content,
                                        timestamp: new Date(Number((_a = msg.messageTimestamp) !== null && _a !== void 0 ? _a : Date.now()) * 1000)
                                    });
                                });
                            };
                            for (var _i = 0, messages_1 = messages; _i < messages_1.length; _i++) {
                                var msg = messages_1[_i];
                                _loop_1(msg);
                            }
                        });
                        return [3 /*break*/, 8];
                    case 6:
                        error_1 = _d.sent();
                        this.connections.delete(connectionId);
                        return [4 /*yield*/, prisma_js_1.prisma.connection.update({
                                where: { id: connectionId },
                                data: { status: 'ERROR' }
                            }).catch(function () { })];
                    case 7:
                        _d.sent();
                        logger_js_1.logger.error('Failed to connect Baileys', { connectionId: connectionId, error: error_1 });
                        throw error_1;
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    BaileysProvider.prototype.disconnect = function (connectionId) {
        return __awaiter(this, void 0, void 0, function () {
            var context, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        context = this.connections.get(connectionId);
                        if (!context)
                            return [2 /*return*/];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, context.socket.logout()];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _a.sent();
                        logger_js_1.logger.warn('Failed to logout Baileys connection', { connectionId: connectionId, error: error_2 });
                        return [3 /*break*/, 4];
                    case 4:
                        this.connections.delete(connectionId);
                        return [4 /*yield*/, prisma_js_1.prisma.connection.update({
                                where: { id: connectionId },
                                data: { status: 'DISCONNECTED' }
                            }).catch(function (error) {
                                logger_js_1.logger.warn('Failed to mark Baileys connection as DISCONNECTED', { connectionId: connectionId, error: error });
                            })];
                    case 5:
                        _a.sent();
                        return [4 /*yield*/, redis_js_1.redis.del("qr:".concat(connectionId)).catch(function (error) {
                                logger_js_1.logger.warn('Failed to clear Baileys QR cache on disconnect', { connectionId: connectionId, error: error });
                            })];
                    case 6:
                        _a.sent();
                        logger_js_1.logger.info('Baileys WhatsApp disconnected', { connectionId: connectionId });
                        return [2 /*return*/];
                }
            });
        });
    };
    BaileysProvider.prototype.isConnected = function (connectionId) {
        return __awaiter(this, void 0, void 0, function () {
            var context;
            var _a;
            return __generator(this, function (_b) {
                context = this.connections.get(connectionId);
                if (!context)
                    return [2 /*return*/, false];
                return [2 /*return*/, Boolean((_a = context.socket.authState.creds) === null || _a === void 0 ? void 0 : _a.me)];
            });
        });
    };
    BaileysProvider.prototype.sendMessage = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var context, jid, socket, result;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        context = this.connections.get(options.connectionId);
                        if (!context) {
                            throw new Error('Connection not found');
                        }
                        jid = buildBaileysJid(options.to);
                        socket = context.socket;
                        if (!options.content.text) return [3 /*break*/, 2];
                        return [4 /*yield*/, socket.sendMessage(jid, { text: options.content.text })];
                    case 1:
                        result = _b.sent();
                        return [3 /*break*/, 13];
                    case 2:
                        if (!options.content.image) return [3 /*break*/, 4];
                        return [4 /*yield*/, socket.sendMessage(jid, {
                                image: { url: options.content.image.url },
                                caption: options.content.image.caption
                            })];
                    case 3:
                        result = _b.sent();
                        return [3 /*break*/, 13];
                    case 4:
                        if (!options.content.audio) return [3 /*break*/, 6];
                        return [4 /*yield*/, socket.sendMessage(jid, {
                                audio: { url: options.content.audio.url },
                                ptt: options.content.audio.ptt
                            })];
                    case 5:
                        result = _b.sent();
                        return [3 /*break*/, 13];
                    case 6:
                        if (!options.content.video) return [3 /*break*/, 8];
                        return [4 /*yield*/, socket.sendMessage(jid, {
                                video: { url: options.content.video.url },
                                caption: options.content.video.caption
                            })];
                    case 7:
                        result = _b.sent();
                        return [3 /*break*/, 13];
                    case 8:
                        if (!options.content.document) return [3 /*break*/, 10];
                        return [4 /*yield*/, socket.sendMessage(jid, {
                                document: { url: options.content.document.url },
                                fileName: options.content.document.filename
                            })];
                    case 9:
                        result = _b.sent();
                        return [3 /*break*/, 13];
                    case 10:
                        if (!options.content.buttons) return [3 /*break*/, 12];
                        return [4 /*yield*/, socket.sendMessage(jid, {
                                text: (_a = options.content.text) !== null && _a !== void 0 ? _a : 'Selecione uma opção',
                                buttons: options.content.buttons.map(function (button) { return ({
                                    buttonId: button.id,
                                    buttonText: { displayText: button.label },
                                    type: 1
                                }); })
                            })];
                    case 11:
                        result = _b.sent();
                        return [3 /*break*/, 13];
                    case 12: throw new Error('No content to send');
                    case 13: return [2 /*return*/, { messageId: result.key.id }];
                }
            });
        });
    };
    BaileysProvider.prototype.onMessage = function (callback) {
        this.messageCallbacks.push(callback);
    };
    return BaileysProvider;
}());
exports.BaileysProvider = BaileysProvider;
exports.baileysProvider = new BaileysProvider();
function buildBaileysJid(raw) {
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
    return "".concat(digits, "@s.whatsapp.net");
}
