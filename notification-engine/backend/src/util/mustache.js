/**
 * Resolves a dot-notation path against an object.
 * Returns undefined if any segment is missing.
 */
function resolvePath(obj, path) {
  return path.split('.').reduce((cur, key) => (cur != null ? cur[key] : undefined), obj);
}

/**
 * Substitutes {{var}} and {{data.nested}} placeholders in a template string.
 * Missing values are replaced with an empty string.
 * No conditionals, no loops — intentionally minimal.
 */
export function render(template, vars) {
  if (typeof template !== 'string') return '';
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, key) => {
    const value = resolvePath(vars, key);
    return value != null ? String(value) : '';
  });
}
