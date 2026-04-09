import type { PackageDocsNavigationItem } from "../../../contracts/presentation/package-docs.js"
import { Stack } from "../primitives/Layout.js"
import { FailureState } from "../primitives/Skeleton.js"

import { PackageDocsCatalogNavigation } from "./PackageDocsCatalogNavigation.js"

export const PackageDocsFailureState = ({
  description,
  navigation,
  navigationTitle
}: {
  readonly description: string
  readonly navigation: ReadonlyArray<PackageDocsNavigationItem>
  readonly navigationTitle: string
}) => (
  <Stack className="gap-6">
    <PackageDocsCatalogNavigation items={navigation} title={navigationTitle} />
    <FailureState description={description} />
  </Stack>
)
