import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PAGE_SIZE, tableHref, type TableParams } from "./params";

export type Column<Row> = {
  key: string;
  label: string;
  sortable?: boolean;
  className?: string;
  cell: (row: Row) => ReactNode;
};

export type FilterControl =
  | { key: string; label: string; type: "select"; options: { value: string; label: string }[] }
  | { key: string; label: string; type: "date" | "text"; placeholder?: string };

type DataTableProps<Row> = {
  basePath: string;
  params: TableParams;
  columns: Column<Row>[];
  rows: Row[];
  total: number;
  rowKey: (row: Row) => string;
  filters?: FilterControl[];
  searchPlaceholder?: string;
  emptyMessage?: string;
};

/**
 * Server-rendered table. Filters and search submit as a GET form; headers and pager are links.
 * The tool queries the database with the parsed TableParams, so all filtering, sorting, and paging run on the server.
 */
export function DataTable<Row>(props: DataTableProps<Row>) {
  const { basePath, params, columns, rows, total, rowKey, filters = [], searchPlaceholder = "Search", emptyMessage = "No records match." } = props;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : params.skip + 1;
  const to = Math.min(params.skip + rows.length, total);

  return (
    <div className="space-y-3">
      <form method="get" action={basePath} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="sort" value={params.sort} />
        <input type="hidden" name="dir" value={params.dir} />
        <label className="flex min-w-56 flex-1 flex-col gap-1 text-xs font-medium text-muted-foreground">
          Search
          <Input name="q" defaultValue={params.q} placeholder={searchPlaceholder} className="text-foreground" />
        </label>
        {filters.map((filter) => (
          <label key={filter.key} className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            {filter.label}
            {filter.type === "select" ? (
              <select
                name={filter.key}
                defaultValue={params.filters[filter.key] ?? ""}
                className="h-8 rounded-lg border border-input bg-background px-2 text-sm text-foreground"
              >
                {filter.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                type={filter.type}
                name={filter.key}
                placeholder={filter.type === "text" ? filter.placeholder : undefined}
                defaultValue={params.filters[filter.key] ?? ""}
                className="text-foreground"
              />
            )}
          </label>
        ))}
        <Button type="submit">Apply</Button>
        <Button asChild variant="outline">
          <Link href={basePath}>Reset</Link>
        </Button>
      </form>

      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.key} className={column.className}>
                  {column.sortable ? <SortLink basePath={basePath} params={params} column={column} /> : column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-8 text-center text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={rowKey(row)}>
                  {columns.map((column) => (
                    <TableCell key={column.key} className={column.className}>
                      {column.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {from}-{to} of {total}
        </span>
        <div className="flex items-center gap-2">
          <PageLink disabled={params.page <= 1} href={tableHref(basePath, params, { page: params.page - 1 })} label="Previous" />
          <span>
            Page {params.page} of {pageCount}
          </span>
          <PageLink disabled={params.page >= pageCount} href={tableHref(basePath, params, { page: params.page + 1 })} label="Next" />
        </div>
      </div>
    </div>
  );
}

function SortLink<Row>({ basePath, params, column }: { basePath: string; params: TableParams; column: Column<Row> }) {
  const active = params.sort === column.key;
  const nextDir = active && params.dir === "asc" ? "desc" : "asc";
  const Icon = !active ? ArrowUpDown : params.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <Link href={tableHref(basePath, params, { sort: column.key, dir: nextDir, page: 1 })} className="inline-flex items-center gap-1 hover:text-foreground">
      {column.label}
      <Icon className="size-3.5" />
    </Link>
  );
}

function PageLink({ disabled, href, label }: { disabled: boolean; href: string; label: string }) {
  if (disabled) {
    return (
      <Button variant="outline" size="sm" disabled>
        {label}
      </Button>
    );
  }
  return (
    <Button asChild variant="outline" size="sm">
      <Link href={href}>{label}</Link>
    </Button>
  );
}
