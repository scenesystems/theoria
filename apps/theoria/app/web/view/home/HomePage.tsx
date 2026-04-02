import * as Arr from "effect/Array"

import { cardsForReleaseStage } from "../../../contracts/card.js"
import { runtimeReleaseStage } from "../../runtime/release-stage.js"
import { appTheme } from "../primitives/designSystem.js"
import { Layer, Stack } from "../primitives/Layout.js"
import { SiteFooter } from "../primitives/SiteFooter.js"
import { SiteHeader } from "../primitives/SiteHeader.js"

import { HomeHero } from "./HomeHero.js"
import { InstrumentSection } from "./InstrumentSection.js"

const visibleCards = cardsForReleaseStage(runtimeReleaseStage())
const effectCards = Arr.filter(visibleCards, (card) => card.group === "effect")
const scenesystemsCards = Arr.filter(visibleCards, (card) => card.group === "scenesystems")

export const HomePage = () => (
  <Layer as="main" className={appTheme.root}>
    <Layer aria-hidden className={appTheme.atmosphericGlowA} />
    <Layer aria-hidden className={appTheme.atmosphericGlowB} />

    <Layer className={appTheme.content}>
      <SiteHeader />
      <HomeHero />

      <Stack className="gap-8">
        <InstrumentSection cards={effectCards} group="effect" />
        <InstrumentSection cards={scenesystemsCards} group="scenesystems" />
      </Stack>

      <SiteFooter />
    </Layer>
  </Layer>
)
