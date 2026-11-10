export const PAGE_SIZE = 20;

export type RawSearchParams = Record<string, string | string[] | undefined>;

export type TableParams<SortKey extends string = string> = {
  page: number;
  sort: SortKey;
  dir: "asc" | "desc";
  q: string;
  filters: Record<string, string>;
  skip: number;
  take: number;
};

type ParseOptions<SortKey extends string> = {
  sortKeys: readonly SortKey[];
  defaultSort: SortKey;
  defaultDir?: "asc" | "desc";
  filterKeys?: readonly string[];
  /** Filter values used when the URL does not set the filter. */
  filterDefaults?: Record<string, string>;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Reads paging, sorting, search, and filter values from the URL, so tables filter and sort on the server. */
export function parseTableParams<SortKey extends string>(raw: RawSearchParams, options: ParseOptions<SortKey>): TableParams<SortKey> {
  const sortValue = first(raw.sort);
  const sort = (options.sortKeys as readonly string[]).includes(sortValue ?? "") ? (sortValue as SortKey) : options.defaultSort;
  const dirValue = first(raw.dir);
  const dir = dirValue === "asc" || dirValue === "desc" ? dirValue : (options.defaultDir ?? "asc");
  const page = Math.max(1, Number.parseInt(first(raw.page) ?? "1", 10) || 1);
  const q = (first(raw.q) ?? "").trim().slice(0, 100);
  const filters: Record<string, string> = {};
  for (const key of options.filterKeys ?? []) {
    const value = first(raw[key]) ?? options.filterDefaults?.[key];
    if (value) filters[key] = value;
  }
  return { page, sort, dir, q, filters, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE };
}

/** Builds a URL that keeps the current table state and applies `changes`. */
export function tableHref(basePath: string, params: TableParams, changes: Partial<Record<string, string | number>>): string {
  const merged: Record<string, string> = { ...params.filters, sort: params.sort, dir: params.dir, page: String(params.page) };
  if (params.q) merged.q = params.q;
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined || value === "") delete merged[key];
    else merged[key] = String(value);
  }
  const search = new URLSearchParams(merged).toString();
  return search ? `${basePath}?${search}` : basePath;
}
