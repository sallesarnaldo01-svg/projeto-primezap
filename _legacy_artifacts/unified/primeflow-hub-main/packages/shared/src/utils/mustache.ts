export function renderTemplate(template: string, variables: Record<string, unknown>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const keys = key.trim().split('.');
    let value: unknown = variables;

    for (const k of keys) {
      if (!value || typeof value !== 'object' || !(k in value)) {
        return match;
      }

      const nextValue = (value as Record<string, unknown>)[k];
      if (nextValue === undefined) {
        return match;
      }

      value = nextValue;
    }

    return value === undefined ? match : String(value);
  });
}

export function extractVariables(template: string): string[] {
  const matches = template.matchAll(/\{\{([^}]+)\}\}/g);
  return Array.from(matches).map(m => m[1].trim());
}
