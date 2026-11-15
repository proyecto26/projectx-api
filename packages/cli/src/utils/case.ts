function words(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);
}

/** Convert string to PascalCase */
export function pascalCase(text: string): string {
  return words(text)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
}

/** Convert string to camelCase */
export function camelCase(text: string): string {
  const pascal = pascalCase(text);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/** Convert string to kebab-case */
export function kebabCase(text: string): string {
  return words(text)
    .map((w) => w.toLowerCase())
    .join("-");
}
