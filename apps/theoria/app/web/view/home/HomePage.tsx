import { metadataForHome } from "../../../contracts/presentation/metadata.js"
import { app } from "../primitives/designSystem.js"
import { DocumentHead } from "../primitives/DocumentHead.js"
import { Layer, Stack } from "../primitives/Layout.js"
import { SiteFooter } from "../primitives/SiteFooter.js"
import { SiteHeader } from "../primitives/SiteHeader.js"

import { HomeHero } from "./HomeHero.js"
import { instrumentEntriesForGroup } from "./instrument-model.js"
import { InstrumentSection } from "./InstrumentSection.js"

export const HomePage = () => (
  <>
    <DocumentHead metadata={metadataForHome()} />

    <Layer as="main" className={app.root}>
      <Layer aria-hidden className={app.atmosphericGlowA} />
      <Layer aria-hidden className={app.atmosphericGlowB} />

      <Layer className={app.content}>
        <SiteHeader />
        <HomeHero />

        <Stack className="gap-8">
          <InstrumentSection cards={instrumentEntriesForGroup("effect")} group="effect" />
          <InstrumentSection cards={instrumentEntriesForGroup("scenesystems")} group="scenesystems" />
        </Stack>

        <SiteFooter />
      </Layer>
    </Layer>
  </>
)
