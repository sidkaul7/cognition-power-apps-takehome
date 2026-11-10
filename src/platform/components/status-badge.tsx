import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "info" | "warning" | "success" | "danger" | "muted";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-800 ring-slate-300",
  info: "bg-blue-50 text-blue-800 ring-blue-200",
  warning: "bg-amber-50 text-amber-900 ring-amber-300",
  success: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  danger: "bg-red-50 text-red-700 ring-red-200",
  muted: "bg-muted text-muted-foreground ring-border",
};

export function StatusBadge({ label, tone = "neutral", className }: { label: string; tone?: BadgeTone; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        TONES[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}
