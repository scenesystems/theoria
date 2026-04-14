import { cn } from "../structure/Box.js"

export type BadgeTone = "neutral" | "info" | "positive" | "attention" | "danger"

const badgeToneClassNames: Record<BadgeTone, string> = {
  neutral: "border-intent-neutral-border bg-intent-neutral-surface text-intent-neutral-content",
  info: "border-intent-info-border bg-intent-info-surface text-intent-info-content",
  positive: "border-intent-positive-border bg-intent-positive-surface text-intent-positive-content",
  attention: "border-intent-attention-border bg-intent-attention-surface text-intent-attention-content",
  danger: "border-intent-danger-border bg-intent-danger-surface text-intent-danger-content"
}

export const badgeClassName = (
  { className, tone }: { readonly className?: string; readonly tone: BadgeTone }
): string =>
  cn(
    "inline-flex min-w-0 items-center gap-2 rounded-ui-pill border px-2.5 py-1 shadow-ui-chip",
    badgeToneClassNames[tone],
    className
  )
