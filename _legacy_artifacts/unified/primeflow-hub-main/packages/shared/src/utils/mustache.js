export function renderTemplate(template, variables) {
    return template.replace(/\{\{([^}]+)\}\}/g, function (match, key) {
        var keys = key.trim().split('.');
        var value = variables;
        for (var _i = 0, keys_1 = keys; _i < keys_1.length; _i++) {
            var k = keys_1[_i];
            value = value === null || value === void 0 ? void 0 : value[k];
            if (value === undefined)
                return match;
        }
        return String(value !== null && value !== void 0 ? value : match);
    });
}
export function extractVariables(template) {
    var matches = template.matchAll(/\{\{([^}]+)\}\}/g);
    return Array.from(matches).map(function (m) { return m[1].trim(); });
}
