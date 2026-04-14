import type { ReactNode } from "react"

import type { SurfaceVariant } from "../../../contracts/presentation/program.js"

import { Stack } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"

type SurfaceSubsectionAppearance = "divided" | "flush"

const surfaceSubsectionClassName = (appearance: SurfaceSubsectionAppearance): string =>
  appearance === "divided"
    ? "gap-4 border-t border-stage-200/82 pt-4 sm:pt-5"
    : "gap-4"

export const SurfaceSubsection = ({
  appearance = "divided",
  children,
  className,
  eyebrow,
  summary,
  title,
  variant = "expanded"
}: {
  readonly appearance?: SurfaceSubsectionAppearance
  readonly children?: ReactNode
  readonly className?: string
  readonly eyebrow?: string
  readonly summary?: string
  readonly title: string
  readonly variant?: SurfaceVariant
}) => (
  <Stack className={`${surfaceSubsectionClassName(appearance)} ${className ?? ""}`.trim()}>
    <Stack className="gap-1.5">
      {eyebrow === undefined
        ? null
        : (
          <SemanticText
            as="span"
            className="text-ink-500"
            role="row-label"
            text={eyebrow}
            variant="compact"
          />
        )}
      <SemanticText as="h3" className="text-ink-900" role="section-title" text={title} variant={variant} />
      {summary === undefined
        ? null
        : (
          <SemanticText
            as="p"
            className="max-w-none text-ink-700"
            role="status"
            text={summary}
            variant={variant}
          />
        )}
    </Stack>
    {children}
  </Stack>
)
