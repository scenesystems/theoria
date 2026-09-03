import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Match, Option } from "effect"
import * as Arr from "effect/Array"

import type { PlaceBuild, ProposalRecord } from "../../../contracts/imagined-place-result.js"
import type { ParticipantRole, PlaceBuildRequest } from "../../../contracts/imagined-place.js"
import { placeControlsAtom } from "../../atoms/imagined-place.js"
import { Layer, Stack } from "../primitives/Layout.js"
import { ShimmerLine } from "../primitives/Skeleton.js"

import { PlaceProposalCard } from "./PlaceProposalCard.js"

const accepts = (controls: PlaceBuildRequest, role: ParticipantRole): boolean =>
  Match.value(role).pipe(
    Match.when("neighbor", () => controls.acceptNeighbor),
    Match.when("program", () => controls.acceptProgram),
    Match.when("author", () => false),
    Match.exhaustive
  )

const toggled = (controls: PlaceBuildRequest, role: ParticipantRole): PlaceBuildRequest =>
  Match.value(role).pipe(
    Match.when("neighbor", () => ({ ...controls, acceptNeighbor: !controls.acceptNeighbor })),
    Match.when("program", () => ({ ...controls, acceptProgram: !controls.acceptProgram })),
    Match.when("author", () => controls),
    Match.exhaustive
  )

const Pending = () => (
  <Stack className="gap-2.5 pt-1">
    <ShimmerLine width="w-1/2" />
    <ShimmerLine width="w-4/5" />
    <ShimmerLine width="w-3/5" />
  </Stack>
)

/**
 * The Propose step: two offers to the author, each signed by its proposer.
 * The switches are the author's decision and never lock: a change during a
 * build starts the next build with the new decision instead of dropping the
 * click. The build that follows records the decision on each card.
 */
export const PlaceProposals = ({ build }: { readonly build: Option.Option<PlaceBuild> }) => {
  const controls = useAtomValue(placeControlsAtom)
  const setControls = useAtomSet(placeControlsAtom)

  return Option.match(build, {
    onNone: () => <Pending />,
    onSome: (value) => (
      <Layer className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        {Arr.map(value.proposals, (record: ProposalRecord) => (
          <PlaceProposalCard
            accepted={accepts(controls, record.proposal.proposer)}
            evidence={value.evidence}
            key={record.proposal.proposer}
            note={record.proposal.proposer === value.evidence.sealedNote.from
              ? Option.some(value.evidence.sealedNote)
              : Option.none()}
            onToggle={() => {
              // From the registry's current value, so two decisions in one tick both land.
              setControls((current) => toggled(current, record.proposal.proposer))
            }}
            record={record}
          />
        ))}
      </Layer>
    )
  })
}
