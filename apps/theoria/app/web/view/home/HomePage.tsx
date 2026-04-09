import { cardsForGroup } from "../../../contracts/entry/card.js"
import { PageMetadata } from "../../../contracts/presentation/metadata.js"
import { DocumentHead } from "../primitives/DocumentHead.js"
import { Layer, Stack } from "../primitives/Layout.js"
import { SiteFooter } from "../primitives/SiteFooter.js"
import { SiteHeader } from "../primitives/SiteHeader.js"
import { app } from "../primitives/theme/surface.js"

import { HomeHero } from "./HomeHero.js"
import { InstrumentSection } from "./InstrumentSection.js"

export const HomePage = () => (
  <>
    <DocumentHead metadata={PageMetadata.home()} />

    <Layer as="main" className={app.root}>
      <Layer aria-hidden className={app.atmosphericGlowA} />
      <Layer aria-hidden className={app.atmosphericGlowB} />

      <Layer className={app.content}>
        <SiteHeader />
        <HomeHero />

        <Stack className="gap-8">
          <InstrumentSection cards={cardsForGroup("effect")} group="effect" />
          <InstrumentSection cards={cardsForGroup("scenesystems")} group="scenesystems" />
        </Stack>

        <SiteFooter />
      </Layer>
    </Layer>
  </>
)
