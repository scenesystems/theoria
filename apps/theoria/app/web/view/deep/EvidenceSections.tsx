import { Match } from "effect"
import * as Arr from "effect/Array"

import type { EvidencePlaneLane } from "../data/evidence-plane-layout.js"
import type { EvidencePlaneViewModel } from "../data/evidence-plane-model.js"
import type { EvidenceSectionViewModel } from "../data/evidence-section-projection.js"

import { Layer, Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"

import { EvidenceSectionCard } from "./EvidenceSectionCard.js"

type RenderedLane = {
  readonly lane: EvidencePlaneLane
  readonly startIndex: number
}

type RenderedLaneState = {
  readonly entries: ReadonlyArray<RenderedLane>
  readonly nextIndex: number
}

const emptyFilterState = (
  <Layer className="border-t border-stage-200/72 py-4">
    <SemanticText
      as="p"
      className="text-ink-700"
      role="status"
      text="No evidence sections match the current lens. Expand the focus or change the view to bring them back into projection."
      variant="expanded"
    />
  </Layer>
)

const sectionList = ({
  sections,
  startIndex,
  spotlight
}: {
  readonly sections: ReadonlyArray<EvidenceSectionViewModel>
  readonly startIndex: number
  readonly spotlight?: boolean
}) => (
  <Stack className="gap-8">
    {Arr.map(sections, (section, index) => (
      <EvidenceSectionCard
        index={startIndex + index}
        key={section.key}
        section={section}
        spotlight={spotlight === true && index === 0}
      />
    ))}
  </Stack>
)

const laneHeader = ({
  lane
}: {
  readonly lane: EvidencePlaneLane
}) => (
  <Stack className="gap-1.5 border-t border-stage-200/68 pt-4">
    <SemanticText as="p" className="max-w-none text-ink-600" role="row-label" text={lane.eyebrow} variant="expanded" />
    <SemanticText
      as="p"
      className="max-w-none text-ink-900"
      role="section-title"
      text={lane.title}
      variant="expanded"
    />
    <SemanticText as="p" className="max-w-none text-ink-700" role="status" text={lane.description} variant="expanded" />
  </Stack>
)

const laneColumn = ({
  lane,
  startIndex
}: {
  readonly lane: EvidencePlaneLane
  readonly startIndex: number
}) => (
  <Stack className="gap-6">
    {laneHeader({ lane })}
    {sectionList({ sections: lane.sections, startIndex })}
  </Stack>
)

const renderedLaneState = (nextIndex: number): RenderedLaneState => ({
  entries: [],
  nextIndex
})

const renderedLanes = ({
  lanes,
  startIndex
}: {
  readonly lanes: ReadonlyArray<EvidencePlaneLane>
  readonly startIndex: number
}): ReadonlyArray<RenderedLane> =>
  lanes.reduce<RenderedLaneState>(
    (state, lane) => ({
      entries: [...state.entries, { lane, startIndex: state.nextIndex }],
      nextIndex: state.nextIndex + lane.sections.length
    }),
    renderedLaneState(startIndex)
  ).entries

const laneLayout = ({
  lanes,
  spotlight
}: {
  readonly lanes: ReadonlyArray<EvidencePlaneLane>
  readonly spotlight: ReadonlyArray<EvidenceSectionViewModel>
}) => (
  <Stack className="gap-8">
    {spotlight.length === 0 ? null : sectionList({ sections: spotlight, spotlight: true, startIndex: 0 })}
    {Arr.map(
      renderedLanes({
        lanes,
        startIndex: spotlight.length
      }),
      ({ lane, startIndex }) => <Stack key={lane.title}>{laneColumn({ lane, startIndex })}</Stack>
    )}
  </Stack>
)

export const EvidenceSections = ({ plane }: { readonly plane: EvidencePlaneViewModel }) =>
  plane.sections.length === 0
    ? emptyFilterState
    : Match.value(plane.layout).pipe(
      Match.tag("Focused", ({ section }) => sectionList({ sections: [section], spotlight: true, startIndex: 0 })),
      Match.tag("Live", ({ lanes, spotlight }) => laneLayout({ lanes, spotlight })),
      Match.tag("Narrative", ({ lanes, spotlight }) => laneLayout({ lanes, spotlight })),
      Match.exhaustive
    )
