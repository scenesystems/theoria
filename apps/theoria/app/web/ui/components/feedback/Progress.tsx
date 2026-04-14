import type { ComponentPropsWithRef, ReactNode } from "react"

import { ProgressBehavior } from "../../behavior/ProgressBehavior.js"
import { mergeClassNames } from "../../structure/Box.js"
import { Inline } from "../../structure/Inline.js"
import { SemanticText } from "../../structure/SemanticText.js"

type ProgressTone = "accent" | "neutral"
type ProgressSize = "sm" | "md"

const progressTrackSizeClassNames: Record<ProgressSize, string> = {
  sm: "h-2",
  md: "h-3"
}

const progressIndicatorToneClassNames: Record<ProgressTone, string> = {
  accent: "bg-content-primary data-[complete]:bg-content-secondary",
  neutral: "bg-border-strong data-[complete]:bg-content-primary"
}

type ProgressProps = Omit<ComponentPropsWithRef<typeof ProgressBehavior.Root>, "children" | "className" | "value"> & {
  readonly className?: string
  readonly label?: ReactNode
  readonly showValue?: boolean
  readonly size?: ProgressSize
  readonly tone?: ProgressTone
  readonly value?: number | null
}

const progressLabelContent = (label: ReactNode): ReactNode =>
  typeof label === "string" ? <SemanticText role="label" tone="muted">{label}</SemanticText> : label

export const Progress = ({
  className,
  label,
  showValue = true,
  size = "md",
  tone = "accent",
  value = null,
  ...props
}: ProgressProps) => (
  <ProgressBehavior.Root
    {...props}
    value={value}
    className={mergeClassNames("flex min-w-0 flex-col gap-2.5", className)}
  >
    {label === undefined && showValue === false
      ? null
      : (
        <Inline align="center" className="justify-between" gap="md">
          {label === undefined ? null : <ProgressBehavior.Label>{progressLabelContent(label)}</ProgressBehavior.Label>}
          {showValue === false
            ? null
            : (
              <ProgressBehavior.Value className="shrink-0">
                {(formattedValue, currentValue) =>
                  currentValue === null ?
                    <SemanticText role="status" tone="muted">In progress</SemanticText> :
                    <SemanticText role="status" tone="muted">{formattedValue}</SemanticText>}
              </ProgressBehavior.Value>
            )}
        </Inline>
      )}

    <ProgressBehavior.Track
      className={mergeClassNames(
        "relative w-full min-w-0 overflow-hidden rounded-ui-pill border border-border-muted bg-surface-sunken",
        progressTrackSizeClassNames[size]
      )}
    >
      <ProgressBehavior.Indicator
        className={mergeClassNames(
          "absolute inset-y-0 left-0 rounded-ui-pill transition-[width,background-color,opacity] duration-300 ease-out data-[indeterminate]:h-full data-[indeterminate]:w-2/5 data-[indeterminate]:animate-pulse",
          progressIndicatorToneClassNames[tone]
        )}
      />
    </ProgressBehavior.Track>
  </ProgressBehavior.Root>
)
