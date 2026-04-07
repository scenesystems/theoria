import { Button } from "@base-ui-components/react/button"
import type { ReactNode } from "react"

import { Cluster, Layer } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"

const tabBase =
  "inline-flex min-h-9 items-center rounded-lg border px-3.5 py-2 transition-colors duration-150 ease-out focus-visible:outline-none"

const tabActiveClass = `${tabBase} border-stage-300 bg-stage-0/98 text-ink-900 shadow-chip`

const tabInactiveClass =
  `${tabBase} border-transparent bg-transparent text-ink-700 hover:border-stage-300 hover:bg-stage-0/90 hover:text-ink-900`

export const TabButton = ({
  active,
  className,
  disabled = false,
  icon,
  label,
  onClick
}: {
  readonly active: boolean
  readonly className?: string
  readonly disabled?: boolean
  readonly icon?: ReactNode
  readonly label: string
  readonly onClick: () => void
}) => (
  <Button
    className={`${active ? tabActiveClass : tabInactiveClass}${
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
  className,
  children
}: {
  readonly className?: string
  readonly children: ReactNode
}) => (
  <Layer
    as="nav"
    className={`flex gap-1 rounded-lg border border-stage-200/95 bg-stage-100/68 p-1${
      className !== undefined ? ` ${className}` : ""
    }`}
  >
    {children}
  </Layer>
)
