"use client";

import { Eye } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/platform/rbac/guards";
import { ReasonDialog } from "./reason-dialog";

type MaskedFieldProps = {
  label: string;
  masked: string;
  /** Present only for users with the reveal permission; the server checks again. */
  onReveal?: (reason: string) => Promise<ActionResult<string>>;
};

/** Shows a masked PII value. A revealed value lives only in component state, so a reload masks it again. */
export function MaskedField({ label, masked, onReveal }: MaskedFieldProps) {
  const [value, setValue] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="font-mono" data-testid={`pii-${label}`}>
        {value ?? masked}
      </span>
      {onReveal && value === null ? (
        <Button size="xs" variant="outline" onClick={() => setOpen(true)} aria-label={`Reveal ${label}`}>
          <Eye /> Reveal
        </Button>
      ) : null}
      {value !== null ? <span className="text-xs text-amber-700">Revealed, logged</span> : null}
      {onReveal ? (
        <ReasonDialog
          open={open}
          onOpenChange={setOpen}
          title={`Reveal ${label}`}
          description="The reveal and your reason are written to the audit log. The value is masked again when the page reloads."
          confirmLabel="Reveal"
          noteLabel="Reason"
          noteRequired
          onConfirm={async ({ note }) => {
            const result = await onReveal(note);
            if (result.ok) setValue(result.data);
            return result;
          }}
        />
      ) : null}
    </span>
  );
}
