import { Match } from "effect"
import type { ReactNode } from "react"

import { Cluster, Layer } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"

const dotClassName = (tone: "live" | "complete" | "error"): string =>
  Match.value(tone).pipe(
    Match.when("live", () => "bg-ink-400 animate-pulse"),
    Match.when("complete", () => "bg-ink-400"),
    Match.orElse(() => "bg-danger-500")
  )

const textClassName = (tone: "live" | "complete" | "error"): string =>
  Match.value(tone).pipe(
    Match.when("error", () => "text-danger-700"),
    Match.orElse(() => "text-ink-600")
  )

export const StageBanner = ({
  action,
  text,
  tone
}: {
  readonly action?: ReactNode
  readonly text: string
  readonly tone: "live" | "complete" | "error"
}) => (
  <Layer className="py-1">
    <Cluster className="flex-wrap items-center gap-x-3 gap-y-1">
      <Cluster className="items-center gap-1.5">
        <Layer
          aria-hidden
          as="span"
          className={`inline-flex size-1.5 shrink-0 rounded-full ${dotClassName(tone)}`}
        />
        <SemanticText as="span" className={textClassName(tone)} role="code-meta" text={text} variant="expanded" />
      </Cluster>
      {action !== undefined ? action : null}
    </Cluster>
  </Layer>
)
