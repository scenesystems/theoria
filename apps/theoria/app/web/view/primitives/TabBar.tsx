import { Button } from "@base-ui/react/button"
import type { ReactNode } from "react"

import { Cluster, Layer } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"

type TabAppearance = "flat" | "segmented"

const segmentedTabBase =
  "inline-flex min-h-9 items-center rounded-lg border px-3.5 py-2 transition-colors duration-150 ease-out focus-visible:outline-none"

const flatTabBase =
  "inline-flex min-h-8 items-center rounded-full px-3 py-1.5 transition-colors duration-150 ease-out focus-visible:outline-none"

const tabClassName = ({
  active,
  appearance
}: {
  readonly active: boolean
  readonly appearance: TabAppearance
}): string => {
  if (appearance === "flat") {
    return active
      ? `${flatTabBase} bg-stage-100 text-ink-900 ring-1 ring-stage-200/80`
      : `${flatTabBase} text-ink-700 hover:bg-stage-50/90 hover:text-ink-900`
  }

  return active
    ? `${segmentedTabBase} border-stage-300 bg-stage-0/98 text-ink-900 shadow-chip`
    : `${segmentedTabBase} border-transparent bg-transparent text-ink-700 hover:border-stage-300 hover:bg-stage-0/90 hover:text-ink-900`
}

const tabBarClassName = ({
  appearance,
  className
}: {
  readonly appearance: TabAppearance
  readonly className: string | undefined
}): string => {
  const baseClassName = appearance === "segmented"
    ? "flex w-fit max-w-full flex-wrap gap-1 rounded-xl border border-stage-200/95 bg-stage-100/68 p-1"
    : "flex w-fit max-w-full flex-wrap gap-1"

  return `${baseClassName}${className !== undefined ? ` ${className}` : ""}`
}

export const TabButton = ({
  active,
  appearance = "segmented",
  className,
  disabled = false,
  icon,
  label,
  onClick
}: {
  readonly active: boolean
  readonly appearance?: TabAppearance
  readonly className?: string
  readonly disabled?: boolean
  readonly icon?: ReactNode
  readonly label: string
  readonly onClick: () => void
}) => (
  <Button
    className={`${tabClassName({ active, appearance })}${
      disabled
        ? " cursor-not-allowed opacity-70 hover:border-transparent hover:bg-transparent hover:text-ink-700"
        : ""
    }${className !== undefined ? ` ${className}` : ""}`}
    disabled={disabled}
    onClick={onClick}
    type="button"
  >
    <Cluster className="gap-1.5 whitespace-nowrap">
      {icon ?? null}
      <SemanticText as="span" className="whitespace-nowrap" role="tab-label" text={label} variant="expanded" />
    </Cluster>
  </Button>
)

export const TabBar = ({
  appearance = "segmented",
  className,
  children
}: {
  readonly appearance?: TabAppearance
  readonly className?: string
  readonly children: ReactNode
}) => (
  <Layer as="nav" className={tabBarClassName({ appearance, className })}>
    {children}
  </Layer>
)
