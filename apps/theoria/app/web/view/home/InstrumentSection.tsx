import { Match } from "effect"
import * as Arr from "effect/Array"

import type { Card, PackageGroup } from "../../../contracts/card.js"
import { groupThemeFor } from "../../../contracts/theme.js"
import { Cluster, Layer, Section, Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"

import { InstrumentCard } from "./InstrumentCard.js"

const groupLabel = (group: PackageGroup): string =>
  Match.value(group).pipe(
    Match.when("effect", () => "Effect Ecosystem"),
    Match.when("scenesystems", () => "Scene Systems"),
    Match.exhaustive
  )

const groupDescription = (group: PackageGroup): string =>
  Match.value(group).pipe(
    Match.when(
      "effect",
      () =>
        "Typed, composable libraries extending the Effect ecosystem with scientific computing, optimization, and language model programming."
    ),
    Match.when(
      "scenesystems",
      () =>
        "Cryptographic primitives built with Effect for content addressing, digital signatures, and authenticated encryption."
    ),
    Match.exhaustive
  )

export const InstrumentSection = ({
  cards,
  group
}: {
  readonly cards: ReadonlyArray<Card>
  readonly group: PackageGroup
}) => {
  const theme = groupThemeFor(group)

  return (
    <Section>
      <Stack className="gap-4">
        <Cluster className="items-center gap-2">
          <Layer as="span" aria-hidden className={`inline-flex h-2 w-2 shrink-0 rounded-full ${theme.dot}`} />
          <SemanticText
            as="h2"
            className="min-w-0 flex-1 text-ink-900"
            role="section-title"
            text={groupLabel(group)}
            variant="expanded"
          />
        </Cluster>

        <SemanticText
          as="p"
          className="min-w-0 text-ink-700"
          role="card-summary"
          text={groupDescription(group)}
          variant="expanded"
        />

        <Stack className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Arr.map(cards, (card) => <InstrumentCard card={card} key={card.id} theme={theme} />)}
        </Stack>
      </Stack>
    </Section>
  )
}
