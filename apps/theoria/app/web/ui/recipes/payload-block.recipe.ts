import { cn } from "../structure/Box.js"

export type PayloadBlockMode = "constrained" | "expanded"

export const payloadBlockClassName = ({ className }: { readonly className?: string }): string =>
  cn("min-w-0 border border-border-rail bg-surface-payload", className)

export const payloadBlockHeaderClassName = ({ className }: { readonly className?: string }): string =>
  cn("flex min-w-0 items-start justify-between gap-3 border-b border-border-rail px-4 py-3", className)

export const payloadBlockBodyClassName = ({
  className,
  mode
}: {
  readonly className?: string
  readonly mode: PayloadBlockMode
}): string =>
  cn(
    "min-w-0 overflow-auto px-4 py-3",
    mode === "constrained" ? "max-h-[var(--ui-workspace-payload-block-max-height)]" : undefined,
    className
  )

export const payloadBlockCodeClassName = ({
  className,
  wrap
}: {
  readonly className?: string
  readonly wrap: boolean
}): string =>
  cn(
    "block font-family-(--font-mono) text-[12px] leading-[18px] text-detail-value",
    wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre overflow-x-auto",
    className
  )
