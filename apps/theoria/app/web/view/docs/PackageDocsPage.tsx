import type { PageMetadata } from "../../../contracts/presentation/metadata.js"
import type { PackageDocsPageRoute } from "../../../contracts/presentation/package-docs.js"
import { DocumentHead } from "../primitives/DocumentHead.js"
import { Layer, Stack } from "../primitives/Layout.js"
import { SiteFooter } from "../primitives/SiteFooter.js"
import { SiteHeader } from "../primitives/SiteHeader.js"
import { app } from "../primitives/theme/surface.js"
import { PackageDocsPageSections } from "./PackageDocsPageSections.js"

export const PackageDocsPage = ({
  metadata,
  route
}: {
  readonly metadata: PageMetadata
  readonly route: PackageDocsPageRoute
}) => (
  <>
    <DocumentHead metadata={metadata} />

    <Layer as="main" className={app.root}>
      <Layer aria-hidden className={app.atmosphericGlowA} />
      <Layer aria-hidden className={app.atmosphericGlowB} />

      <Layer className={app.content}>
        <SiteHeader />
        <Stack className="gap-6">
          <PackageDocsPageSections route={route} />
        </Stack>
        <SiteFooter />
      </Layer>
    </Layer>
  </>
)
