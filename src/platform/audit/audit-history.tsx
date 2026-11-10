import type { AuditEvent } from "@prisma/client";
import { formatDateTime } from "../components/format";
import { AUDIT_ACTION_LABELS, summarizeChange } from "./labels";

/** Timeline of every audit event on one record, for record detail pages. */
export function AuditHistory({ events }: { events: AuditEvent[] }) {
  if (events.length === 0) return <p className="text-sm text-muted-foreground">No history yet.</p>;
  return (
    <ol className="space-y-3">
      {events.map((event) => (
        <li key={event.id} className="border-l-2 border-muted pl-3 text-sm" data-action={event.action}>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-medium">{AUDIT_ACTION_LABELS[event.action] ?? event.action}</span>
            <code className="text-xs text-muted-foreground">{event.action}</code>
            <span className="text-muted-foreground">by {event.actorName ?? "Unknown"}</span>
            <span className="text-xs text-muted-foreground">{formatDateTime(event.createdAt)}</span>
          </div>
          {summarizeChange(event.before, event.after) ? <div className="text-xs text-muted-foreground">{summarizeChange(event.before, event.after)}</div> : null}
          {event.reason ? <div className="text-xs">Reason: {event.reason}</div> : null}
        </li>
      ))}
    </ol>
  );
}
