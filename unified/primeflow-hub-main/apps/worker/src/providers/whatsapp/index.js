"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWhatsAppProvider = getWhatsAppProvider;
exports.listWhatsAppProviders = listWhatsAppProviders;
var env_js_1 = require("../../config/env.js");
var venom_provider_js_1 = require("./venom.provider.js");
var baileys_provider_js_1 = require("./baileys.provider.js");
var providers = {
    venom: venom_provider_js_1.venomProvider,
    baileys: baileys_provider_js_1.baileysProvider
};
function getWhatsAppProvider(providerKey) {
    if (providerKey === void 0) { providerKey = env_js_1.env.WHATSAPP_PROVIDER; }
    var key = providerKey;
    var provider = providers[key];
    if (!provider) {
        throw new Error("Unsupported WhatsApp provider \"".concat(providerKey, "\""));
    }
    return provider;
}
function listWhatsAppProviders() {
    return Object.keys(providers);
}
