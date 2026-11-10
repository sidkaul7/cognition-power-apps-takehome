"use client";

import { useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/platform/rbac/guards";

export type ReasonCodeOption = { value: string; label: string };
export type ReasonValues = { note: string; reasonCode?: string };

export type ReasonDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  confirmVariant?: "default" | "destructive" | "outline";
  noteLabel: string;
  noteRequired: boolean;
  reasonCodes?: ReasonCodeOption[];
  onConfirm: (values: ReasonValues) => Promise<ActionResult<unknown>>;
};

/** Collects a typed reason (and optional reason code) before a sensitive action, and shows server errors. */
export function ReasonDialog(props: ReasonDialogProps) {
  const { open, onOpenChange, title, description, confirmLabel, confirmVariant = "default", noteLabel, noteRequired, reasonCodes, onConfirm } = props;
  const [note, setNote] = useState("");
  const [reasonCode, setReasonCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset(next: boolean) {
    if (!next) {
      setNote("");
      setReasonCode("");
      setError(null);
    }
    onOpenChange(next);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (reasonCodes && !reasonCode) return setError("Choose a reason code.");
    if (noteRequired && !note.trim()) return setError(`${noteLabel} is required.`);
    startTransition(async () => {
      const result = await onConfirm({ note: note.trim(), reasonCode: reasonCodes ? reasonCode : undefined });
      if (result.ok) reset(false);
      else setError(result.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
          {reasonCodes ? (
            <div className="space-y-1.5">
              <Label htmlFor="reason-code">Reason code</Label>
              <select
                id="reason-code"
                value={reasonCode}
                onChange={(event) => setReasonCode(event.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">Select a reason</option>
                {reasonCodes.map((code) => (
                  <option key={code.value} value={code.value}>
                    {code.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="reason-note">
              {noteLabel}
              {noteRequired ? "" : " (optional)"}
            </Label>
            <Textarea id="reason-note" value={note} onChange={(event) => setNote(event.target.value)} rows={3} />
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => reset(false)}>
              Cancel
            </Button>
            <Button type="submit" variant={confirmVariant} disabled={pending}>
              {pending ? "Saving..." : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
