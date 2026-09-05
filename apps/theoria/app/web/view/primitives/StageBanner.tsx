import { Match } from "effect"
import type { ReactNode } from "react"

import { Cluster, Layer } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"
import { PulseLayer } from "./Skeleton.js"

const dotClassName = "inline-flex size-1.5 shrink-0 rounded-full"

/** The banner's dot: pulsing while live, still once complete, danger-toned on error. */
const Dot = ({ tone }: { readonly tone: "live" | "complete" | "error" }) =>
  Match.value(tone).pipe(
    Match.when("live", () => <PulseLayer ariaHidden className={`${dotClassName} bg-ink-400`} />),
    Match.when("complete", () => <Layer aria-hidden render={<span />} className={`${dotClassName} bg-ink-400`} />),
    Match.orElse(() => <Layer aria-hidden render={<span />} className={`${dotClassName} bg-danger-500`} />)
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
        <Dot tone={tone} />
        <SemanticText as="span" className={textClassName(tone)} role="code-meta" text={text} variant="expanded" />
      </Cluster>
      {action}
    </Cluster>
  </Layer>
)
