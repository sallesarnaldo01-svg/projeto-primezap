export function renderTemplate(template, variables) {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
        const keys = key.trim().split('.');
        let value = variables;
        for (const k of keys) {
            if (!value || typeof value !== 'object' || !(k in value)) {
                return match;
            }
            const nextValue = value[k];
            if (nextValue === undefined) {
                return match;
            }
            value = nextValue;
        }
        return value === undefined ? match : String(value);
    });
}
export function extractVariables(template) {
    const matches = template.matchAll(/\{\{([^}]+)\}\}/g);
    return Array.from(matches).map(m => m[1].trim());
}
