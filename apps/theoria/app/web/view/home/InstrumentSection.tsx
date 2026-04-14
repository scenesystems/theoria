import * as Arr from "effect/Array"

import type { HomeCatalogSectionPresentation } from "../../../contracts/presentation/home-catalog.js"
import { Box } from "../../ui/structure/Box.js"
import { Cluster } from "../../ui/structure/Cluster.js"
import { Grid } from "../../ui/structure/Grid.js"
import { SemanticText } from "../../ui/structure/SemanticText.js"
import { Stack } from "../../ui/structure/Stack.js"
import { InstrumentCard } from "./InstrumentCard.js"

export const InstrumentSection = ({
  section
}: {
  readonly section: HomeCatalogSectionPresentation
}) => {
  return (
    <Stack as="section" className="gap-5">
      <Stack className="gap-3">
        <Cluster gap="sm">
          <Box
            as="span"
            aria-hidden
            className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-tone-digest-400"
          />
          <SemanticText className="text-content-primary" role="display-sm">{section.title}</SemanticText>
        </Cluster>
        <SemanticText className="max-w-[44rem] text-content-muted" role="body">{section.description}</SemanticText>
      </Stack>

      <Grid columns={2} gap="md">
        {Arr.map(section.cards, (card) => <InstrumentCard card={card} key={card.id} />)}
      </Grid>
    </Stack>
  )
}
