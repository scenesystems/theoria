import { useAtomValue } from "@effect-atom/atom-react"
import { Match } from "effect"

import { PackageDocsPageContent } from "../../../contracts/presentation/package-docs.js"
import { packageDocsCurrentRouteStateAtom } from "../../atoms/package-docs-route.js"
import { Skeleton } from "../../ui/components/feedback/Skeleton.js"
import { Card } from "../../ui/components/surface/Card.js"
import { WorkspaceRailLayout } from "../../ui/components/workspace/WorkspaceRailLayout.js"
import { Box } from "../../ui/structure/Box.js"
import { Cluster } from "../../ui/structure/Cluster.js"
import { SemanticText } from "../../ui/structure/SemanticText.js"
import { Stack } from "../../ui/structure/Stack.js"

import { PackageDocsCatalogSections } from "./PackageDocsCatalogSections.js"
import { PackageDocsOverview } from "./PackageDocsOverview.js"
import { PackageDocsSectionGroups } from "./PackageDocsSectionGroups.js"

const PackageDocsRunningState = ({ text }: { readonly text: string }) => (
  <Stack className="gap-4 py-4">
    <Cluster className="gap-2">
      <Box aria-hidden as="span" className="inline-flex size-2 animate-pulse rounded-full bg-stage-400" />
      <SemanticText as="span" className="text-ink-600" role="status">{text}</SemanticText>
    </Cluster>
    <Stack className="gap-3">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" tone="muted" />
    </Stack>
  </Stack>
)

const PackageDocsFailureState = ({ description }: { readonly description: string }) => (
  <Stack className="gap-4 py-4">
    <Card className="border-danger-200/70 bg-danger-50/70 p-4">
      <Cluster className="gap-2">
        <Box aria-hidden as="span" className="inline-flex size-2 rounded-full bg-danger-500" />
        <SemanticText as="span" className="text-danger-700" role="status">{description}</SemanticText>
      </Cluster>
    </Card>
    <Stack className="gap-3 opacity-15">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-24 w-full" />
    </Stack>
  </Stack>
)

const mainSection = (section: PackageDocsPageContent["sections"][number]) =>
  Match.value(section).pipe(
    Match.tag("SearchPanel", () => null),
    Match.tag("RunningState", ({ text }) => <PackageDocsRunningState text={text} />),
    Match.tag("FailureState", ({ description }) => <PackageDocsFailureState description={description} />),
    Match.tag("Overview", ({ model }) => <PackageDocsOverview model={model} />),
    Match.tag("SectionGroups", ({ groups }) => <PackageDocsSectionGroups groups={groups} />),
    Match.orElse(() => null)
  )

export const PackageDocsPageSections = () => {
  const content = PackageDocsPageContent.project(useAtomValue(packageDocsCurrentRouteStateAtom))
  const hasCatalogSections = content.sections.some((section) => section._tag === "Navigation")
  const main = content.sections.map((s, i) => ({ node: mainSection(s), key: `m:${s._tag}:${String(i)}` }))
    .filter((entry) => entry.node !== null)

  if (hasCatalogSections === false) {
    return (
      <Box className="flex min-h-full flex-1 flex-col pt-2 sm:pt-3">
        <Stack className="flex-1 gap-4 sm:gap-5">
          {main.map((entry) => <Box key={entry.key}>{entry.node}</Box>)}
        </Stack>
      </Box>
    )
  }

  return (
    <WorkspaceRailLayout
      className="min-h-full flex-1 pt-2 sm:pt-3"
      content={
        <Stack className="min-h-full gap-4 sm:gap-5">
          {main.map((entry) => <Box key={entry.key}>{entry.node}</Box>)}
        </Stack>
      }
      contentClassName="min-h-full overflow-visible"
      rail={<PackageDocsCatalogSections />}
      railClassName="hidden xl:block"
      railSticky
      width="md"
    />
  )
}
