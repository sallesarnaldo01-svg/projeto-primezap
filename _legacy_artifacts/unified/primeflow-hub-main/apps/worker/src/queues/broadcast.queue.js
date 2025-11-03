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
exports.broadcastWorker = exports.broadcastQueue = void 0;
var bullmq_1 = require("bullmq");
var redis_js_1 = require("../lib/redis.js");
var logger_js_1 = require("../lib/logger.js");
var prisma_js_1 = require("../lib/prisma.js");
var env_js_1 = require("../config/env.js");
var index_js_1 = require("../providers/whatsapp/index.js");
exports.broadcastQueue = new bullmq_1.Queue('broadcast-run', {
    connection: redis_js_1.bullmqConnection
});
exports.broadcastWorker = new bullmq_1.Worker('broadcast-run', function (job) { return __awaiter(void 0, void 0, void 0, function () {
    var broadcast, contacts, config, intervalSec, baseDelayMs, pauseEveryN, pauseForSec, stats, _i, contacts_1, contact, jitter, delay, error_1, error_2;
    var _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                logger_js_1.logger.info('Processing broadcast job', { jobId: job.id, data: job.data });
                return [4 /*yield*/, prisma_js_1.prisma.broadcast.findUnique({
                        where: { id: job.data.broadcastId }
                    })];
            case 1:
                broadcast = _d.sent();
                if (!broadcast) {
                    throw new Error('Broadcast not found');
                }
                // Update status to RUNNING
                return [4 /*yield*/, prisma_js_1.prisma.broadcast.update({
                        where: { id: broadcast.id },
                        data: { status: 'RUNNING' }
                    })];
            case 2:
                // Update status to RUNNING
                _d.sent();
                _d.label = 3;
            case 3:
                _d.trys.push([3, 18, , 20]);
                return [4 /*yield*/, getRecipients(broadcast)];
            case 4:
                contacts = _d.sent();
                config = broadcast.config;
                intervalSec = Number((_a = config === null || config === void 0 ? void 0 : config.intervalSec) !== null && _a !== void 0 ? _a : 1);
                baseDelayMs = Math.max(0, intervalSec) * 1000;
                pauseEveryN = Number((_b = config === null || config === void 0 ? void 0 : config.pauseEveryN) !== null && _b !== void 0 ? _b : 0);
                pauseForSec = Number((_c = config === null || config === void 0 ? void 0 : config.pauseForSec) !== null && _c !== void 0 ? _c : 0);
                stats = { queued: contacts.length, sent: 0, failed: 0, progress: 0 };
                _i = 0, contacts_1 = contacts;
                _d.label = 5;
            case 5:
                if (!(_i < contacts_1.length)) return [3 /*break*/, 16];
                contact = contacts_1[_i];
                _d.label = 6;
            case 6:
                _d.trys.push([6, 12, , 13]);
                // Execute script actions for this contact
                return [4 /*yield*/, executeScript(broadcast, contact, config)];
            case 7:
                // Execute script actions for this contact
                _d.sent();
                stats.sent++;
                stats.progress = calculateProgress(stats, contacts.length);
                jitter = Math.random() * (env_js_1.env.BROADCAST_JITTER_PCT / 100);
                delay = baseDelayMs > 0 ? baseDelayMs * (1 + jitter) : 0;
                if (!(delay > 0)) return [3 /*break*/, 9];
                return [4 /*yield*/, sleep(delay)];
            case 8:
                _d.sent();
                _d.label = 9;
            case 9:
                if (!(pauseEveryN > 0 && pauseForSec > 0 && stats.sent % pauseEveryN === 0)) return [3 /*break*/, 11];
                logger_js_1.logger.info('Broadcast paused', { broadcastId: broadcast.id });
                return [4 /*yield*/, sleep(pauseForSec * 1000)];
            case 10:
                _d.sent();
                _d.label = 11;
            case 11: return [3 /*break*/, 13];
            case 12:
                error_1 = _d.sent();
                logger_js_1.logger.error('Failed to send to contact', { error: error_1, contactId: contact.id });
                stats.failed++;
                stats.progress = calculateProgress(stats, contacts.length);
                return [3 /*break*/, 13];
            case 13: 
            // Update progress
            return [4 /*yield*/, prisma_js_1.prisma.broadcast.update({
                    where: { id: broadcast.id },
                    data: { stats: stats }
                })];
            case 14:
                // Update progress
                _d.sent();
                _d.label = 15;
            case 15:
                _i++;
                return [3 /*break*/, 5];
            case 16:
                if (contacts.length === 0) {
                    stats.progress = 100;
                }
                // Mark as DONE
                return [4 /*yield*/, prisma_js_1.prisma.broadcast.update({
                        where: { id: broadcast.id },
                        data: { status: 'DONE', stats: stats }
                    })];
            case 17:
                // Mark as DONE
                _d.sent();
                return [2 /*return*/, { success: true, stats: stats }];
            case 18:
                error_2 = _d.sent();
                return [4 /*yield*/, prisma_js_1.prisma.broadcast.update({
                        where: { id: broadcast.id },
                        data: { status: 'FAILED' }
                    })];
            case 19:
                _d.sent();
                throw error_2;
            case 20: return [2 /*return*/];
        }
    });
}); }, {
    connection: redis_js_1.bullmqConnection,
    concurrency: env_js_1.env.BROADCAST_MAX_CONCURRENCY
});
function getRecipients(broadcast) {
    return __awaiter(this, void 0, void 0, function () {
        var filters;
        var _a, _b;
        return __generator(this, function (_c) {
            filters = broadcast.filters;
            return [2 /*return*/, prisma_js_1.prisma.contact.findMany({
                    where: __assign(__assign({ tenantId: broadcast.tenantId }, (((_a = filters.sources) === null || _a === void 0 ? void 0 : _a.length) && {
                        source: { in: filters.sources }
                    })), (((_b = filters.tags) === null || _b === void 0 ? void 0 : _b.length) && {
                        tags: {
                            some: {
                                tagId: { in: filters.tags }
                            }
                        }
                    }))
                })];
        });
    });
}
function executeScript(broadcast, contact, config) {
    return __awaiter(this, void 0, void 0, function () {
        var script, contextConfig, _i, script_1, action, type, _a;
        var _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    script = Array.isArray(broadcast.script) ? broadcast.script : [];
                    contextConfig = __assign(__assign({}, config), { broadcastId: broadcast.id });
                    _i = 0, script_1 = script;
                    _d.label = 1;
                case 1:
                    if (!(_i < script_1.length)) return [3 /*break*/, 8];
                    action = script_1[_i];
                    type = action === null || action === void 0 ? void 0 : action.type;
                    logger_js_1.logger.info('Execute broadcast action', { type: type, contactId: contact.id });
                    _a = type;
                    switch (_a) {
                        case 'message': return [3 /*break*/, 2];
                        case 'delay': return [3 /*break*/, 4];
                    }
                    return [3 /*break*/, 6];
                case 2: return [4 /*yield*/, handleMessageAction((_b = action.config) !== null && _b !== void 0 ? _b : {}, contact, contextConfig)];
                case 3:
                    _d.sent();
                    return [3 /*break*/, 7];
                case 4: return [4 /*yield*/, handleDelayAction((_c = action.config) !== null && _c !== void 0 ? _c : {})];
                case 5:
                    _d.sent();
                    return [3 /*break*/, 7];
                case 6:
                    logger_js_1.logger.warn('Unsupported broadcast action type, skipping', { type: type });
                    _d.label = 7;
                case 7:
                    _i++;
                    return [3 /*break*/, 1];
                case 8: return [2 /*return*/];
            }
        });
    });
}
function sleep(ms) {
    return new Promise(function (resolve) { return setTimeout(resolve, ms); });
}
function handleMessageAction(actionConfig, contact, broadcastConfig) {
    return __awaiter(this, void 0, void 0, function () {
        var connectionId, providerKey, provider, to, content, isConnected, response;
        var _a, _b, _c, _d, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    connectionId = (_a = actionConfig.connectionId) !== null && _a !== void 0 ? _a : broadcastConfig === null || broadcastConfig === void 0 ? void 0 : broadcastConfig.connectionId;
                    if (!connectionId) {
                        throw new Error('Missing WhatsApp connection for broadcast action');
                    }
                    providerKey = (_b = actionConfig.provider) !== null && _b !== void 0 ? _b : broadcastConfig === null || broadcastConfig === void 0 ? void 0 : broadcastConfig.provider;
                    provider = providerKey ? (0, index_js_1.getWhatsAppProvider)(providerKey) : (0, index_js_1.getWhatsAppProvider)();
                    to = normalizePhone((_d = (_c = actionConfig.to) !== null && _c !== void 0 ? _c : contact.phone) !== null && _d !== void 0 ? _d : '');
                    if (!to) {
                        throw new Error('Contact does not have a valid phone number');
                    }
                    content = buildMessageContent(actionConfig, contact, broadcastConfig);
                    if (!hasMessageContent(content)) {
                        throw new Error('Broadcast message has no content to send');
                    }
                    return [4 /*yield*/, provider.isConnected(connectionId)];
                case 1:
                    isConnected = _f.sent();
                    if (!isConnected) {
                        throw new Error('WhatsApp connection is not connected');
                    }
                    return [4 /*yield*/, provider.sendMessage({
                            connectionId: connectionId,
                            to: to,
                            content: content,
                            metadata: {
                                contactId: contact.id
                            }
                        })];
                case 2:
                    response = _f.sent();
                    return [4 /*yield*/, prisma_js_1.prisma.messageLog.create({
                            data: {
                                broadcastId: (_e = broadcastConfig === null || broadcastConfig === void 0 ? void 0 : broadcastConfig.broadcastId) !== null && _e !== void 0 ? _e : null,
                                contactId: contact.id,
                                status: 'sent',
                                sentAt: new Date()
                            }
                        }).catch(function (error) {
                            logger_js_1.logger.warn('Failed to log broadcast message', { error: error, contactId: contact.id });
                        })];
                case 3:
                    _f.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function handleDelayAction(config) {
    return __awaiter(this, void 0, void 0, function () {
        var seconds, milliseconds, durationMs;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    seconds = Number((_a = config === null || config === void 0 ? void 0 : config.seconds) !== null && _a !== void 0 ? _a : 0);
                    milliseconds = Number((_b = config === null || config === void 0 ? void 0 : config.milliseconds) !== null && _b !== void 0 ? _b : 0);
                    durationMs = milliseconds > 0 ? milliseconds : seconds * 1000;
                    if (!(durationMs > 0)) return [3 /*break*/, 2];
                    return [4 /*yield*/, sleep(durationMs)];
                case 1:
                    _c.sent();
                    _c.label = 2;
                case 2: return [2 /*return*/];
            }
        });
    });
}
function buildMessageContent(actionConfig, contact, broadcastConfig) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    var content = {};
    var signatureEnabled = (_a = broadcastConfig === null || broadcastConfig === void 0 ? void 0 : broadcastConfig.signature) === null || _a === void 0 ? void 0 : _a.enabled;
    var signatureName = (_b = broadcastConfig === null || broadcastConfig === void 0 ? void 0 : broadcastConfig.signature) === null || _b === void 0 ? void 0 : _b.customName;
    var renderedText = renderTemplate((_c = actionConfig.text) !== null && _c !== void 0 ? _c : actionConfig.message, contact);
    if (renderedText) {
        content.text = signatureEnabled
            ? appendSignature(renderedText, signatureName)
            : renderedText;
    }
    var mediaUrl = (_d = actionConfig.mediaUrl) !== null && _d !== void 0 ? _d : (_e = actionConfig.media) === null || _e === void 0 ? void 0 : _e.url;
    var mediaType = (_f = actionConfig.mediaType) !== null && _f !== void 0 ? _f : (_g = actionConfig.media) === null || _g === void 0 ? void 0 : _g.type;
    if (mediaUrl && mediaType) {
        switch (mediaType) {
            case 'image':
                content.image = {
                    url: mediaUrl,
                    caption: renderTemplate(actionConfig.caption, contact)
                };
                break;
            case 'audio':
                content.audio = { url: mediaUrl, ptt: Boolean(actionConfig.ptt) };
                break;
            case 'video':
                content.video = {
                    url: mediaUrl,
                    caption: renderTemplate(actionConfig.caption, contact)
                };
                break;
            case 'document':
                content.document = {
                    url: mediaUrl,
                    filename: (_h = actionConfig.filename) !== null && _h !== void 0 ? _h : 'document'
                };
                break;
            default:
                break;
        }
    }
    if (Array.isArray(actionConfig.buttons) && actionConfig.buttons.length > 0) {
        content.buttons = actionConfig.buttons.map(function (button) {
            var _a, _b, _c, _d;
            return ({
                id: String((_b = (_a = button.id) !== null && _a !== void 0 ? _a : button.value) !== null && _b !== void 0 ? _b : button.label),
                label: (_d = renderTemplate((_c = button.label) !== null && _c !== void 0 ? _c : button.text, contact)) !== null && _d !== void 0 ? _d : ''
            });
        });
    }
    if (actionConfig.list) {
        content.list = {
            title: (_j = renderTemplate(actionConfig.list.title, contact)) !== null && _j !== void 0 ? _j : '',
            sections: (actionConfig.list.sections || []).map(function (section) {
                var _a;
                return ({
                    title: (_a = renderTemplate(section.title, contact)) !== null && _a !== void 0 ? _a : '',
                    rows: (section.rows || []).map(function (row) {
                        var _a, _b, _c, _d;
                        return ({
                            id: String((_b = (_a = row.id) !== null && _a !== void 0 ? _a : row.value) !== null && _b !== void 0 ? _b : row.title),
                            title: (_c = renderTemplate(row.title, contact)) !== null && _c !== void 0 ? _c : '',
                            description: (_d = renderTemplate(row.description, contact)) !== null && _d !== void 0 ? _d : undefined
                        });
                    })
                });
            })
        };
    }
    return content;
}
function hasMessageContent(content) {
    return Boolean(content.text ||
        content.image ||
        content.audio ||
        content.video ||
        content.document ||
        (content.buttons && content.buttons.length > 0) ||
        content.list);
}
function normalizePhone(rawPhone) {
    if (!rawPhone)
        return '';
    var trimmed = rawPhone.trim();
    if (trimmed.includes('@')) {
        return trimmed;
    }
    var digits = trimmed.replace(/\D/g, '');
    return digits;
}
function renderTemplate(template, contact) {
    var _a, _b, _c;
    if (typeof template !== 'string' || template.length === 0) {
        return undefined;
    }
    var replacements = {
        name: (_a = contact === null || contact === void 0 ? void 0 : contact.name) !== null && _a !== void 0 ? _a : '',
        phone: (_b = contact === null || contact === void 0 ? void 0 : contact.phone) !== null && _b !== void 0 ? _b : '',
        email: (_c = contact === null || contact === void 0 ? void 0 : contact.email) !== null && _c !== void 0 ? _c : ''
    };
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, function (_, key) {
        var _a;
        return (_a = replacements[key]) !== null && _a !== void 0 ? _a : '';
    });
}
function appendSignature(text, signatureName) {
    if (!signatureName) {
        return "".concat(text, "\n\n-- Equipe Primeflow");
    }
    return "".concat(text, "\n\n-- ").concat(signatureName);
}
function calculateProgress(stats, total) {
    if (total <= 0) {
        return 100;
    }
    var processed = stats.sent + stats.failed;
    if (processed <= 0) {
        return 0;
    }
    return Math.min(100, Math.round((processed / total) * 100));
}
exports.broadcastWorker.on('completed', function (job) {
    logger_js_1.logger.info('Broadcast job completed', { jobId: job.id });
});
exports.broadcastWorker.on('failed', function (job, error) {
    logger_js_1.logger.error('Broadcast job failed', { jobId: job === null || job === void 0 ? void 0 : job.id, error: error.message });
});
