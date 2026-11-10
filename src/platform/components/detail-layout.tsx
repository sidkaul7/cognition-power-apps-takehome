import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DetailLayoutProps = {
  title: string;
  subtitle?: ReactNode;
  badges?: ReactNode;
  backLink?: ReactNode;
  /** Main column: profile, documents, history. */
  children: ReactNode;
  /** Side column: decision panel and key facts. */
  aside?: ReactNode;
};

export function DetailLayout({ title, subtitle, badges, backLink, children, aside }: DetailLayoutProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        {backLink}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {badges}
        </div>
        {subtitle ? <div className="text-sm text-muted-foreground">{subtitle}</div> : null}
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">{children}</div>
        {aside ? <aside className="space-y-6">{aside}</aside> : null}
      </div>
    </div>
  );
}

export function DetailSection({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function FieldList({ fields }: { fields: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {fields.map((field) => (
        <div key={field.label} className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{field.label}</dt>
          <dd className="mt-0.5 break-words text-sm">{field.value}</dd>
        </div>
      ))}
    </dl>
  );
}
