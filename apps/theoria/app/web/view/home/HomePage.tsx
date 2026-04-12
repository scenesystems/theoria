import { Result } from "@effect-atom/atom"
import { useAtomValue } from "@effect-atom/atom-react"

import {
  HomeCatalogAvailabilityChecking,
  HomeCatalogAvailabilityResolved,
  HomeCatalogAvailabilityUnavailable,
  HomeCatalogPresentation
} from "../../../contracts/presentation/home-catalog.js"
import type { PageMetadata } from "../../../contracts/presentation/metadata.js"
import { capabilityAvailabilityAtom } from "../../atoms/capability-availability.js"
import { packageVersionsAtom } from "../../atoms/package-versions.js"
import { runtimeReleaseStage } from "../../runtime/release-stage.js"
import { DocumentHead } from "../primitives/DocumentHead.js"
import { Layer, Stack } from "../primitives/Layout.js"
import { SiteFooter } from "../primitives/SiteFooter.js"
import { SiteHeader } from "../primitives/SiteHeader.js"
import { app } from "../primitives/theme/surface.js"

import { HomeHero } from "./HomeHero.js"
import { InstrumentSection } from "./InstrumentSection.js"

export const HomePage = ({ metadata }: { readonly metadata: PageMetadata }) => {
  const availabilityResult = useAtomValue(capabilityAvailabilityAtom)
  const versionsResult = useAtomValue(packageVersionsAtom)
  const releaseStage = runtimeReleaseStage()
  const catalog = HomeCatalogPresentation.project({
    availability: Result.match(availabilityResult, {
      onInitial: () => HomeCatalogAvailabilityChecking.checking(),
      onFailure: () => HomeCatalogAvailabilityUnavailable.unavailable(),
      onSuccess: (success) => HomeCatalogAvailabilityResolved.fromSnapshot(success.value)
    }),
    packageVersions: Result.match(versionsResult, {
      onInitial: () => null,
      onFailure: () => null,
      onSuccess: (success) => success.value
    }),
    releaseStage
  })

  return (
    <>
      <DocumentHead metadata={metadata} />

      <Layer as="main" className={app.root}>
        <Layer aria-hidden className={app.atmosphericGlowA} />
        <Layer aria-hidden className={app.atmosphericGlowB} />

        <Layer className={app.content}>
          <SiteHeader />
          <HomeHero />

          <Stack className="gap-8">
            {catalog.sections.map((section) => <InstrumentSection key={section.group} section={section} />)}
          </Stack>

          <SiteFooter />
        </Layer>
      </Layer>
    </>
  )
}
