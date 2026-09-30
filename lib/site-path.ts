import config from "./site-config.json";

export const BASE_PATH = config.basePath;
export const SITE_ORIGIN = config.siteOrigin;

/** Prefix only app-local URLs; leave fragments and external sources unchanged. */
export function sitePath(path: string) {
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  if (path === BASE_PATH || path.startsWith(`${BASE_PATH}/`)) return path;
  return `${BASE_PATH}${path}`;
}
