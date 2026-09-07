import { Option } from "effect"

import { type ToneClasses } from "./designSystem.js"
import { Cluster, Layer } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"

/**
 * One entry of a legend: a dot in the tone it stands for, the number a disc
 * shows when it is too small for its name, and the name. Both place legends
 * — who made what, and which numbered disc is which — are set with it, so
 * they read alike.
 */
export const LegendItem = ({
  index,
  label,
  tone
}: {
  readonly index?: number
  readonly label: string
  readonly tone: ToneClasses
}) => (
  <Cluster className="items-center gap-1.5">
    <Layer aria-hidden render={<span />} className={`inline-flex size-2 shrink-0 rounded-full ${tone.bg}`} />
    {Option.match(Option.fromNullable(index), {
      onNone: () => null,
      onSome: (value) => (
        <SemanticText as="span" className="tabular-nums text-ink-500" role="row-value" text={String(value)} />
      )
    })}
    <SemanticText as="span" className="text-ink-700" role="row-value" text={label} />
  </Cluster>
)
