import { useAtomValue } from "@effect-atom/atom-react"
import { Match } from "effect"

import { PackageDocsPageContent, type PackageDocsPageRoute } from "../../../contracts/presentation/package-docs.js"
import { packageDocsRouteStateAtom } from "../../atoms/package-docs-route.js"
import { Layer } from "../primitives/Layout.js"
import { FailureState, RunningState } from "../primitives/Skeleton.js"

import { PackageDocsCatalogNavigation } from "./PackageDocsCatalogNavigation.js"
import { PackageDocsOverview } from "./PackageDocsOverview.js"
import { PackageDocsSearchPanel } from "./PackageDocsSearchPanel.js"
import { PackageDocsSectionGroups } from "./PackageDocsSectionGroups.js"

const packageDocsPageSectionNode = ({
  route,
  section
}: {
  readonly route: PackageDocsPageRoute
  readonly section: PackageDocsPageContent["sections"][number]
}) =>
  Match.value(section).pipe(
    Match.tag("SearchPanel", () => <PackageDocsSearchPanel route={route} />),
    Match.tag("RunningState", ({ text }) => <RunningState text={text} />),
    Match.tag("FailureState", ({ description }) => <FailureState description={description} />),
    Match.tag("Navigation", ({ items, title }) => <PackageDocsCatalogNavigation items={items} title={title} />),
    Match.tag("Overview", ({ model }) => <PackageDocsOverview model={model} />),
    Match.tag("SectionGroups", ({ groups }) => <PackageDocsSectionGroups groups={groups} />),
    Match.exhaustive
  )

export const PackageDocsPageSections = ({ route }: { readonly route: PackageDocsPageRoute }) => {
  const content = PackageDocsPageContent.project(useAtomValue(packageDocsRouteStateAtom(route)))

  return content.sections.map((section, index) => (
    <Layer key={`${section._tag}:${String(index)}`}>
      {packageDocsPageSectionNode({ route, section })}
    </Layer>
  ))
}
