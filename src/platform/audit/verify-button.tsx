"use client";

import { useState, useTransition } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { verifyAuditAction } from "./actions";
import type { ChainVerification } from "./index";

export function VerifyIntegrityButton() {
  const [result, setResult] = useState<ChainVerification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-3">
      <Button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const response = await verifyAuditAction({});
            if (response.ok) {
              setResult(response.data);
              setError(null);
            } else setError(response.error);
          })
        }
      >
        {pending ? "Verifying..." : "Verify integrity"}
      </Button>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {result?.ok ? (
        <Alert className="border-emerald-300 bg-emerald-50 text-emerald-900">
          <AlertTitle>Chain intact</AlertTitle>
          <AlertDescription>All {result.checked} audit events verified. Every hash matches.</AlertDescription>
        </Alert>
      ) : null}
      {result && !result.ok ? (
        <Alert variant="destructive">
          <AlertTitle>Chain broken at event #{result.brokenEventId}</AlertTitle>
          <AlertDescription>
            {result.problem} {result.checked} events before it verified.
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
