"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { claimCaseAction } from "../actions";

export function ClaimButton({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <span className="inline-flex items-center gap-2">
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await claimCaseAction({ caseId });
            if (result.ok) router.refresh();
            else setError(result.error);
          })
        }
      >
        {pending ? "Claiming..." : "Claim"}
      </Button>
      {error ? <span role="alert" className="text-xs text-destructive">{error}</span> : null}
    </span>
  );
}
