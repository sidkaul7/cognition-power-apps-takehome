"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActionResult } from "@/platform/rbac/guards";
import { ReasonDialog, type ReasonCodeOption, type ReasonValues } from "./reason-dialog";

export type DecisionOption = {
  id: string;
  label: string;
  variant?: "default" | "destructive" | "outline";
  dialogTitle: string;
  dialogDescription?: string;
  noteLabel: string;
  noteRequired: boolean;
  reasonCodes?: ReasonCodeOption[];
};

type DecisionPanelProps = {
  title?: string;
  description?: string;
  /** Only the decisions the server-side rules allow for this user and record. */
  options: DecisionOption[];
  emptyMessage: string;
  onDecide: (optionId: string, values: ReasonValues) => Promise<ActionResult<unknown>>;
};

export function DecisionPanel({ title = "Decision", description, options, emptyMessage, onDecide }: DecisionPanelProps) {
  const router = useRouter();
  const [active, setActive] = useState<DecisionOption | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        {options.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {options.map((option) => (
              <Button key={option.id} variant={option.variant ?? "default"} onClick={() => setActive(option)}>
                {option.label}
              </Button>
            ))}
          </div>
        )}
      </CardContent>
      {active ? (
        <ReasonDialog
          open
          onOpenChange={(open) => !open && setActive(null)}
          title={active.dialogTitle}
          description={active.dialogDescription}
          confirmLabel={active.label}
          confirmVariant={active.variant}
          noteLabel={active.noteLabel}
          noteRequired={active.noteRequired}
          reasonCodes={active.reasonCodes}
          onConfirm={async (values) => {
            const result = await onDecide(active.id, values);
            if (result.ok) router.refresh();
            return result;
          }}
        />
      ) : null}
    </Card>
  );
}
