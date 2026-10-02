/** The feed currently stores one year with MM.DD keys; URLs use unambiguous ISO dates. */
export function archiveDateLabel(year: number, key: string): string {
  return `${year}-${key.replace(".", "-")}`;
}

export function archiveDateFromSearch(search: string, year: number, keys: readonly string[]): string {
  const requested = new URLSearchParams(search).get("date");
  return keys.find((key) => archiveDateLabel(year, key) === requested) || keys[0] || "";
}

export function archiveDateUrl(href: string, year: number, key: string, latest: string): string {
  const url = new URL(href);
  if (key === latest) url.searchParams.delete("date");
  else url.searchParams.set("date", archiveDateLabel(year, key));
  return `${url.pathname}${url.search}${url.hash}`;
}
