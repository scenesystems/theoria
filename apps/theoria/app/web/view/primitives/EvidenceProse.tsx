import * as Arr from "effect/Array"

import type { EvidenceSectionGroup } from "../../../contracts/evidence/section-presentation.js"

import { Layer, Stack } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"

type ProseItem = Extract<EvidenceSectionGroup, { readonly _tag: "Prose" }>["items"][number]

const denseValue = (value: string): boolean =>
  value.length >= 84 && /^[A-Za-z0-9+/_=-]+$/.test(value.replaceAll("\n", ""))

const proseValueNode = (item: ProseItem) =>
  denseValue(item.value)
    ? (
      <SemanticText
        as="p"
        className="text-ink-800"
        role="code-block"
        text={item.value}
        variant="expanded"
      />
    )
    : <SemanticText as="dd" className="text-ink-800" role="row-value" text={item.value} variant="expanded" />

export const EvidenceProse = (
  { items }: { readonly items: Extract<EvidenceSectionGroup, { readonly _tag: "Prose" }>["items"] }
) => (
  <Layer as="dl" className="grid gap-0.5">
    {Arr.map(items, (item, index) => (
      <Layer
        key={`${item.label}-${index}`}
        className={`${
          index === 0 ? "" : "border-t border-stage-200/58"
        } grid gap-2 py-3 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] sm:gap-5`}
      >
        <SemanticText as="dt" className="text-ink-600" role="row-label" text={item.label} variant="expanded" />
        <Stack className="gap-1.5">{proseValueNode(item)}</Stack>
      </Layer>
    ))}
  </Layer>
)
