/**
 * When the frontend is deployed separately from the API (the InfinityFree
 * static export calling a Vercel-hosted API), this points fetches at the
 * external origin. Same-origin deploys (Vercel) leave it unset and get
 * ordinary relative paths.
 */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
