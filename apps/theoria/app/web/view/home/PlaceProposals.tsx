import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Match, type Option } from "effect"
import * as Arr from "effect/Array"

import type { PlaceBuild } from "../../../contracts/imagined-place-result.js"
import {
  type OfferedProposal,
  type ParticipantRole,
  type PlaceOutline,
  versionShapes
} from "../../../contracts/imagined-place.js"
import { type PlaceControls, placeControlsAtom } from "../../atoms/imagined-place.js"
import { Layer } from "../primitives/Layout.js"

import { PlaceProposal } from "./PlaceProposal.js"

const accepts = (controls: PlaceControls, role: ParticipantRole): boolean =>
  Match.value(role).pipe(
    Match.when("neighbor", () => controls.acceptNeighbor),
    Match.when("program", () => controls.acceptProgram),
    Match.when("author", () => false),
    Match.exhaustive
  )

const toggled = (controls: PlaceControls, role: ParticipantRole): PlaceControls =>
  Match.value(role).pipe(
    Match.when("neighbor", () => ({ ...controls, acceptNeighbor: !controls.acceptNeighbor })),
    Match.when("program", () => ({ ...controls, acceptProgram: !controls.acceptProgram })),
    Match.when("author", () => controls),
    Match.exhaustive
  )

/**
 * The Propose act: two offers to the author, each signed by its proposer,
 * as marginalia. A merged proposal knows the line of the drawn prose its
 * sentence stands on. The switches are the author's decision and never lock:
 * a change during a build starts the next build with the new decision
 * instead of dropping the click. The build that follows records the decision
 * on each proposal. The offers are laid out from the recording before the
 * build is here, so the act has its shape from its first frame.
 */
export const PlaceProposals = ({ build, offered, outline }: {
  readonly build: Option.Option<PlaceBuild>
  readonly offered: ReadonlyArray<OfferedProposal>
  readonly outline: PlaceOutline
}) => {
  const controls = useAtomValue(placeControlsAtom)
  const setControls = useAtomSet(placeControlsAtom)
  // The version a merged proposal is in: the last the outline has.
  const mergedInto = Arr.lastNonEmpty(versionShapes(outline))

  return (
    <Layer className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
      {Arr.map(offered, (proposal) => (
        <PlaceProposal
          accepted={accepts(controls, proposal.proposal.proposer)}
          build={build}
          key={proposal.proposal.proposer}
          mergedInto={mergedInto}
          offered={proposal}
          onToggle={() => {
            // From the registry's current value, so two decisions in one tick both land.
            setControls((current) => toggled(current, proposal.proposal.proposer))
          }}
        />
      ))}
    </Layer>
  )
}
