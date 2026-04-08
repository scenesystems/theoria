import { Match } from "effect"
import * as Arr from "effect/Array"

import type { EvidenceSectionGroup, EvidenceSectionViewModel } from "../data/evidence-layout.js"

import { DataTable } from "../primitives/DataTable.js"
import { evidenceSectionFor } from "../primitives/designSystem.js"
import { EvidenceItemRenderer } from "../primitives/EvidenceItemRenderer.js"
import { EvidenceProse } from "../primitives/EvidenceProse.js"
import { Layer, Section, Stack } from "../primitives/Layout.js"
import { MetricStrip } from "../primitives/MetricStrip.js"
import { SelectionRail } from "../primitives/SelectionLayout.js"
import { SemanticText } from "../primitives/SemanticText.js"

const animationDelayClassName = (index: number): string =>
  Match.value(Math.min(index, 5)).pipe(
    Match.when(0, () => "[animation-delay:0ms]"),
    Match.when(1, () => "[animation-delay:60ms]"),
    Match.when(2, () => "[animation-delay:120ms]"),
    Match.when(3, () => "[animation-delay:180ms]"),
    Match.when(4, () => "[animation-delay:240ms]"),
    Match.orElse(() => "[animation-delay:300ms]")
  )

const visualGridClassName = (count: number): string => count === 1 ? "grid gap-2.5" : "grid gap-2.5 xl:grid-cols-2"

const metricGroups = (groups: ReadonlyArray<EvidenceSectionGroup>) =>
  groups.flatMap((group) => group._tag === "Metrics" ? [group] : [])

const proseGroups = (groups: ReadonlyArray<EvidenceSectionGroup>) =>
  groups.flatMap((group) => group._tag === "Prose" ? [group] : [])

const visualGroups = (groups: ReadonlyArray<EvidenceSectionGroup>) =>
  groups.flatMap((group) => group._tag === "Visuals" ? [group] : [])

const tableGroups = (groups: ReadonlyArray<EvidenceSectionGroup>) =>
  groups.flatMap((group) => group._tag === "Table" ? [group] : [])

const joinText = (parts: ReadonlyArray<string | null>): string =>
  parts.flatMap((part) => part === null ? [] : [part]).join(" · ")

const renderGroup = (group: EvidenceSectionGroup) =>
  Match.value(group).pipe(
    Match.tag(
      "Metrics",
      ({ layout, metrics }) => (
        <MetricStrip
          density={layout === "hero" ? "standard" : "compact"}
          emphasis={layout === "hero" ? "hero" : "standard"}
          metrics={metrics}
          surface="flush"
          variant={layout === "strip" ? "strip" : "grid"}
        />
      )
    ),
    Match.tag("Prose", ({ items }) => <EvidenceProse items={items} />),
    Match.tag("Visuals", ({ items }) => (
      <Layer className={visualGridClassName(items.length)}>
        {Arr.map(
          items,
          (item, index) => <EvidenceItemRenderer item={item} key={`${item._tag}-${index}`} surface="flush" />
        )}
      </Layer>
    )),
    Match.tag(
      "Table",
      ({ item }) => <DataTable columns={item.columns} density="compact" label={item.label} rows={item.rows} />
    ),
    Match.exhaustive
  )

const renderGroups = (groups: ReadonlyArray<EvidenceSectionGroup>) =>
  Arr.map(groups, (group, index) => <Layer key={`${group._tag}-${index}`}>{renderGroup(group)}</Layer>)

const supportGrid = (groups: ReadonlyArray<EvidenceSectionGroup>) =>
  groups.length === 0
    ? null
    : <Layer className={groups.length === 1 ? "grid gap-3" : "grid gap-3 lg:grid-cols-2"}>{renderGroups(groups)}</Layer>

const splitGroups = ({
  aside,
  main
}: {
  readonly aside: ReadonlyArray<EvidenceSectionGroup>
  readonly main: ReadonlyArray<EvidenceSectionGroup>
}) =>
  main.length === 0 && aside.length === 0
    ? null
    : main.length === 0
    ? <Stack className="gap-4">{renderGroups(aside)}</Stack>
    : aside.length === 0
    ? <Stack className="gap-4">{renderGroups(main)}</Stack>
    : (
      <Layer className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.95fr)]">
        <Stack className="gap-3">{renderGroups(main)}</Stack>
        <Stack className="gap-3">{renderGroups(aside)}</Stack>
      </Layer>
    )

const SectionHeader = ({
  section,
  spotlight
}: {
  readonly section: EvidenceSectionViewModel
  readonly spotlight: boolean
}) => {
  const theme = evidenceSectionFor(section.variant)
  const latestLabel = section.latest ? spotlight ? "Live now" : "Newest evidence" : null

  return (
    <SelectionRail
      accent={<Layer className={`mt-1 h-8 w-[0.35rem] shrink-0 rounded-full ${theme.accent}`} />}
      action={
        <Stack className="min-w-0 gap-1 md:items-end">
          <SemanticText
            as="p"
            className="text-ink-500"
            role="row-label"
            text={section.itemCountLabel}
            variant="expanded"
          />
          <SemanticText
            as="p"
            className="text-ink-600"
            role="code-meta"
            text={section.badge}
            variant="expanded"
          />
        </Stack>
      }
      actionBreakpoint="md"
      actionClassName="col-span-2 md:col-span-1"
      className="gap-y-2.5"
    >
      <Stack className="min-w-0 gap-1.5">
        <SemanticText
          as="p"
          className={`max-w-none ${theme.eyebrow}`}
          role="row-label"
          text={joinText([section.eyebrow, latestLabel])}
          variant="expanded"
        />
        <SemanticText
          as="h3"
          className={`max-w-none ${spotlight ? "text-ink-900" : "text-ink-800"}`}
          role="card-title"
          text={section.title}
          variant="expanded"
        />
        <SemanticText
          as="p"
          className="max-w-none text-ink-600"
          role="card-summary"
          text={section.summaryText}
          variant="expanded"
        />
      </Stack>
    </SelectionRail>
  )
}

const sectionBody = ({
  section,
  spotlight
}: {
  readonly section: EvidenceSectionViewModel
  readonly spotlight: boolean
}) => {
  const metrics = metricGroups(section.groups)
  const prose = proseGroups(section.groups)
  const visuals = visualGroups(section.groups)
  const tables = tableGroups(section.groups)
  const support = [...prose, ...tables]

  return Match.value(section.variant).pipe(
    Match.when("highlight", () => (
      <Stack className={spotlight ? "gap-6" : "gap-5"}>
        {renderGroups(metrics)}
        {splitGroups({ aside: support, main: visuals })}
      </Stack>
    )),
    Match.when("analysis", () => (
      <Stack className="gap-5">
        {splitGroups({ aside: [...metrics, ...prose], main: [...visuals, ...tables] })}
      </Stack>
    )),
    Match.when("context", () => (
      <Stack className="gap-5">
        <Stack className="gap-5">{renderGroups(prose)}</Stack>
        {supportGrid([...metrics, ...visuals, ...tables])}
      </Stack>
    )),
    Match.when("dataset", () => (
      <Stack className="gap-5">
        <Stack className="gap-5">{renderGroups(tables)}</Stack>
        {supportGrid([...metrics, ...visuals, ...prose])}
      </Stack>
    )),
    Match.exhaustive
  )
}

export const EvidenceSectionCard = ({
  index,
  section,
  spotlight = false
}: {
  readonly index: number
  readonly section: EvidenceSectionViewModel
  readonly spotlight?: boolean
}) => {
  const shellClassName = index === 0 ? "" : "border-t border-stage-200/72 pt-6"

  return (
    <Section className={`evidence-section-enter ${animationDelayClassName(index)}`}>
      <Layer className={shellClassName}>
        <SectionHeader section={section} spotlight={spotlight} />
        <Stack className={`${spotlight ? "gap-5 pt-4" : "gap-5 pt-4"}`}>{sectionBody({ section, spotlight })}</Stack>
      </Layer>
    </Section>
  )
}
