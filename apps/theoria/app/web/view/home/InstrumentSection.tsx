import * as Arr from "effect/Array"

import { type Card, type PackageGroup, packageGroupMeta } from "../../../contracts/card.js"
import { representativeToneFor } from "../../../contracts/theme.js"
import { toneClassesFor } from "../primitives/designSystem.js"
import { Cluster, Layer, Section, Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"

import { InstrumentCard } from "./InstrumentCard.js"

export const InstrumentSection = ({
  cards,
  group
}: {
  readonly cards: ReadonlyArray<Card>
  readonly group: PackageGroup
}) => {
  const groupTone = toneClassesFor(representativeToneFor(group))

  return (
    <Section>
      <Stack className="gap-4">
        <Cluster className="items-center gap-2">
          <Layer as="span" aria-hidden className={`inline-flex h-2 w-2 shrink-0 rounded-full ${groupTone.dot}`} />
          <SemanticText
            as="h2"
            className="min-w-0 flex-1 text-ink-900"
            role="section-title"
            text={packageGroupMeta(group).label}
            variant="expanded"
          />
        </Cluster>

        <SemanticText
          as="p"
          className="min-w-0 text-ink-700"
          role="card-summary"
          text={packageGroupMeta(group).description}
          variant="expanded"
        />

        <Stack className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {Arr.map(cards, (card) => <InstrumentCard card={card} key={card.id} tone={groupTone} />)}
        </Stack>
      </Stack>
    </Section>
  )
}
