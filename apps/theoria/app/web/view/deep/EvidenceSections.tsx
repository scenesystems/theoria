import { Separator } from "@base-ui-components/react/separator"
import { Match } from "effect"
import * as Arr from "effect/Array"

import type { EvidenceSection } from "../../../contracts/evidence.js"

import { evidenceSpan } from "../data/evidence-layout.js"
import { EvidenceGrid, EvidenceGridItem } from "../primitives/EvidenceGrid.js"
import { Cluster, Section, Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { StatusPill } from "../primitives/StatusPill.js"

import { EvidenceItemRenderer } from "../primitives/EvidenceItemRenderer.js"

const sectionItemCount = (section: EvidenceSection): string => {
  const n = section.items.length
  return n === 1 ? "1 metric" : `${n} metrics`
}

const animationDelayClassName = (index: number): string =>
  Match.value(Math.min(index, 5)).pipe(
    Match.when(0, () => "[animation-delay:0ms]"),
    Match.when(1, () => "[animation-delay:60ms]"),
    Match.when(2, () => "[animation-delay:120ms]"),
    Match.when(3, () => "[animation-delay:180ms]"),
    Match.when(4, () => "[animation-delay:240ms]"),
    Match.orElse(() => "[animation-delay:300ms]")
  )

const SectionHeader = ({ section }: { readonly section: EvidenceSection }) => (
  <Cluster as="span" className="inline-flex gap-2">
    <SemanticText as="span" className="text-ink-900" role="section-title" text={section.title} variant="expanded" />
    <StatusPill className="bg-stage-100 text-ink-700" label={sectionItemCount(section)} />
  </Cluster>
)

export const EvidenceSections = ({ sections }: { readonly sections: ReadonlyArray<EvidenceSection> }) => (
  <Stack className="gap-0">
    {Arr.map(
      sections,
      (section, index) => (
        <Section key={section.title} className={`evidence-section-enter py-4 ${animationDelayClassName(index)}`}>
          {index > 0 ? <Separator className="mb-4 h-px bg-stage-200/80" /> : null}
          <SectionHeader section={section} />
          <EvidenceGrid>
            {Arr.map(section.items, (item, itemIndex) => (
              <EvidenceGridItem key={itemIndex} span={evidenceSpan(item)}>
                <EvidenceItemRenderer item={item} />
              </EvidenceGridItem>
            ))}
          </EvidenceGrid>
        </Section>
      )
    )}
  </Stack>
)
