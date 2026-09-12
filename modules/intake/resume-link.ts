export const RESUME_PATH_PREFIX = "/estimate/resume";

function withoutTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function buildResumeUrl(token: string, origin: string): string {
  return `${withoutTrailingSlash(origin)}${RESUME_PATH_PREFIX}/${encodeURIComponent(token)}`;
}
