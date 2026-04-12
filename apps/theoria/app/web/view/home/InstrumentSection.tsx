import * as Arr from "effect/Array"

import type { HomeCatalogSectionPresentation } from "../../../contracts/presentation/home-catalog.js"
import { Cluster, Layer, Section, Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { toneFor } from "../primitives/theme/tone.js"
import { InstrumentCard } from "./InstrumentCard.js"

export const InstrumentSection = ({
  section
}: {
  readonly section: HomeCatalogSectionPresentation
}) => {
  const groupTone = toneFor(section.tone)

  return (
    <Section>
      <Stack className="gap-4">
        <Cluster className="items-center gap-2">
          <Layer as="span" aria-hidden className={`inline-flex h-2 w-2 shrink-0 rounded-full ${groupTone.dot}`} />
          <SemanticText
            as="h2"
            className="min-w-0 flex-1 text-ink-900"
            role="section-title"
            text={section.title}
            variant="expanded"
          />
        </Cluster>

        <SemanticText
          as="p"
          className="min-w-0 text-ink-700"
          role="card-summary"
          text={section.description}
          variant="expanded"
        />

        <Stack className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {Arr.map(section.cards, (card) => <InstrumentCard card={card} key={card.id} tone={groupTone} />)}
        </Stack>
      </Stack>
    </Section>
  )
}
