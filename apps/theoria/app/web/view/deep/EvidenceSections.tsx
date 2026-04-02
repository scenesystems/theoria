import { Match } from "effect"
import * as Arr from "effect/Array"

import type { EvidencePlaneLane, EvidencePlaneViewModel, EvidenceSectionViewModel } from "../data/evidence-layout.js"

import { Layer, Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"

import { EvidenceSectionCard } from "./EvidenceSectionCard.js"

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

export const EvidenceSections = ({ plane }: { readonly plane: EvidencePlaneViewModel }) =>
  plane.sections.length === 0
    ? emptyFilterState
    : Match.value(plane.layout).pipe(
      Match.tag("Focused", ({ section }) => sectionList({ sections: [section], spotlight: true, startIndex: 0 })),
      Match.tag("Live", ({ spotlight, stream }) => (
        <Stack className="gap-8">
          {spotlight === null ? null : sectionList({ sections: [spotlight], spotlight: true, startIndex: 0 })}
          {stream === null
            ? null
            : laneColumn({ lane: stream, startIndex: spotlight === null ? 0 : 1 })}
        </Stack>
      )),
      Match.tag("Narrative", ({ spotlight, narrative, reference }) => (
        <Stack className="gap-8">
          {spotlight === null ? null : sectionList({ sections: [spotlight], spotlight: true, startIndex: 0 })}
          {narrative === null && reference === null
            ? null
            : narrative === null
            ? laneColumn({ lane: reference!, startIndex: spotlight === null ? 0 : 1 })
            : reference === null
            ? laneColumn({ lane: narrative, startIndex: spotlight === null ? 0 : 1 })
            : (
              <Stack className="gap-8">
                {laneColumn({ lane: narrative, startIndex: spotlight === null ? 0 : 1 })}
                {laneColumn({
                  lane: reference,
                  startIndex: spotlight === null ? narrative.sections.length : narrative.sections.length + 1
                })}
              </Stack>
            )}
        </Stack>
      )),
      Match.exhaustive
    )
