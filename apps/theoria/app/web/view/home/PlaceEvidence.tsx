import { Collapsible } from "@base-ui-components/react/collapsible"
import { ChevronRightIcon } from "@heroicons/react/20/solid"
import { Option } from "effect"
import * as Arr from "effect/Array"

import { type Card, cards } from "../../../contracts/card.js"
import type { Id as CardId } from "../../../contracts/id.js"
import type { PlaceBuild } from "../../../contracts/imagined-place-result.js"
import { toneForCard } from "../../../contracts/theme.js"
import type { PlaceRenderFrame } from "../../atoms/imagined-place-render.js"
import { CodeBlock } from "../primitives/CodeBlock.js"
import { toneClassesFor } from "../primitives/designSystem.js"
import { Cluster, Layer, Stack } from "../primitives/Layout.js"
import { InternalLink } from "../primitives/Link.js"
import { MetricStrip } from "../primitives/MetricStrip.js"
import { SemanticText } from "../primitives/SemanticText.js"

import { placePipelineExcerpt } from "./placePipelineExcerpt.js"
import { buildMetrics } from "./placeViewModel.js"

/** What each package does in this demo, in the order the pipeline uses them. */
const rolesByCard: ReadonlyArray<readonly [CardId, string]> = [
  ["effect-dsp", "typed programs"],
  ["effect-inference", "recorded model runtime"],
  ["digest", "content IDs, HKDF"],
  ["sign", "Ed25519, X25519"],
  ["seal", "XChaCha20-Poly1305"],
  ["effect-text", "line breaking"],
  ["effect-math", "geometry, statistics"],
  ["effect-search", "TPE study"]
]

const linkClassName =
  "inline-flex max-w-full min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 rounded-md border bg-stage-100/60 px-2.5 py-1.5 transition-colors hover:bg-stage-0 focus-visible:outline-none focus-visible:ring-2"

const triggerClassName =
  "group inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-stage-300/90 bg-stage-0/88 px-3 py-1.5 text-ink-900 shadow-chip transition-colors hover:border-ink-400 hover:bg-stage-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/20"

const panelClassName =
  "h-[var(--collapsible-panel-height)] overflow-hidden transition-[height,opacity] duration-200 data-[ending-style]:h-0 data-[ending-style]:opacity-0 data-[starting-style]:h-0 data-[starting-style]:opacity-0"

const PackageLink = ({ card, role }: { readonly card: Card; readonly role: string }) => {
  const tone = toneClassesFor(toneForCard(card.id))
  return (
    <InternalLink className={`${linkClassName} ${tone.borderSubtle} ${tone.focusRing}`} href={`/docs/${card.id}`}>
      <SemanticText as="span" className={tone.text} role="tab-label" text={card.packageName} />
      <SemanticText as="span" className="text-ink-600" role="code-meta" text={role} />
    </InternalLink>
  )
}

const packageLinks = Arr.filterMap(rolesByCard, ([id, role]) =>
  Option.map(
    Arr.findFirst(cards, (card) => card.id === id),
    (card) => <PackageLink card={card} key={card.id} role={role} />
  ))

/**
 * Where each package is documented, always visible, and the proof behind the
 * build (metrics and the condensed pipeline) behind one disclosure.
 */
export const PlaceEvidence = ({
  build,
  frame
}: {
  readonly build: PlaceBuild
  readonly frame: Option.Option<PlaceRenderFrame>
}) => (
  <Stack className="gap-4">
    <Cluster className="gap-2">{packageLinks}</Cluster>
    <Collapsible.Root>
      <Layer className="flex">
        <Collapsible.Trigger className={triggerClassName}>
          <SemanticText as="span" role="button-label" text="How it's built" />
          <ChevronRightIcon
            aria-hidden
            className="size-4 text-ink-500 transition-transform duration-150 group-data-[panel-open]:rotate-90"
          />
        </Collapsible.Trigger>
      </Layer>
      <Collapsible.Panel className={panelClassName}>
        <Stack className="gap-5 pt-5">
          <MetricStrip density="compact" metrics={buildMetrics(build, frame)} surface="panel" variant="grid" />
          <CodeBlock label="The pipeline, condensed" source={placePipelineExcerpt} />
        </Stack>
      </Collapsible.Panel>
    </Collapsible.Root>
  </Stack>
)
