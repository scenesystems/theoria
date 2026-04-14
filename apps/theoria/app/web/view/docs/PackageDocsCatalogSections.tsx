import { useAtomValue } from "@effect-atom/atom-react"
import { Match } from "effect"

import { PackageDocsPageContent } from "../../../contracts/presentation/package-docs.js"
import { packageDocsCurrentRouteStateAtom } from "../../atoms/package-docs-route.js"
import { Box } from "../../ui/structure/Box.js"
import { Stack } from "../../ui/structure/Stack.js"

import { PackageDocsCatalogNavigation } from "./PackageDocsCatalogNavigation.js"

const catalogSection = (
  section: PackageDocsPageContent["sections"][number],
  onNavigate: (() => void) | undefined,
  showTitles: boolean
) =>
  Match.value(section).pipe(
    Match.tag(
      "Navigation",
      ({ items, title }) => (
        <PackageDocsCatalogNavigation
          items={items}
          showTitle={showTitles}
          title={title}
          {...(onNavigate === undefined ? {} : { onNavigate })}
        />
      )
    ),
    Match.orElse(() => null)
  )

export const PackageDocsCatalogSections = ({
  onNavigate,
  showTitles = true
}: {
  readonly onNavigate?: () => void
  readonly showTitles?: boolean
}) => {
  const content = PackageDocsPageContent.project(useAtomValue(packageDocsCurrentRouteStateAtom))
  const sections = content.sections
    .map((section, index) => ({
      key: `s:${section._tag}:${String(index)}`,
      node: catalogSection(section, onNavigate, showTitles)
    }))
    .filter((entry) => entry.node !== null)

  if (sections.length === 0) {
    return null
  }

  return (
    <Stack className="gap-3">
      {sections.map((entry) => <Box key={entry.key}>{entry.node}</Box>)}
    </Stack>
  )
}
