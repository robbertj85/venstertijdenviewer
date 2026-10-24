// Set at build time when the app is served under a subpath
// (prototype.transportlab.app/venstertijdenviewer). Empty for local dev.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

export function withBase(path: string): string {
  return `${BASE_PATH}${path}`;
}
