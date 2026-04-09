const externalApiUrl = import.meta.env.VITE_API_URL as string | undefined;
const internalBase = import.meta.env.BASE_URL.replace(/\/$/, "");

export const API_BASE = externalApiUrl
  ? externalApiUrl.replace(/\/$/, "")
  : internalBase;

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
