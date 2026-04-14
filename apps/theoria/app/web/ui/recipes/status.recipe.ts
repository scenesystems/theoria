import { cn } from "../structure/Box.js"

export type StatusTone = "neutral" | "info" | "positive" | "attention" | "danger"

const statusToneClassNames: Record<StatusTone, { readonly dot: string; readonly root: string }> = {
  neutral: {
    dot: "bg-intent-neutral-content",
    root: "border-intent-neutral-border bg-intent-neutral-surface text-intent-neutral-content"
  },
  info: {
    dot: "bg-intent-info-content",
    root: "border-intent-info-border bg-intent-info-surface text-intent-info-content"
  },
  positive: {
    dot: "bg-intent-positive-content",
    root: "border-intent-positive-border bg-intent-positive-surface text-intent-positive-content"
  },
  attention: {
    dot: "bg-intent-attention-content",
    root: "border-intent-attention-border bg-intent-attention-surface text-intent-attention-content"
  },
  danger: {
    dot: "bg-intent-danger-content",
    root: "border-intent-danger-border bg-intent-danger-surface text-intent-danger-content"
  }
}

export const statusPillClassName = (
  { className, tone }: { readonly className?: string; readonly tone: StatusTone }
): string =>
  cn(
    "inline-flex min-w-0 items-center gap-2 rounded-ui-pill border px-2.5 py-1 shadow-ui-chip",
    statusToneClassNames[tone].root,
    className
  )

export const statusDotClassName = (tone: StatusTone): string => statusToneClassNames[tone].dot
