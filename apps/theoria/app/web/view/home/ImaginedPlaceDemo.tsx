import { Result } from "@effect-atom/atom"
import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Match, Option } from "effect"
import * as Arr from "effect/Array"

import type { PlaceBuild, ProposalRecord } from "../../../contracts/imagined-place-result.js"
import type { ParticipantRole, PlaceBuildRequest } from "../../../contracts/imagined-place.js"
import { placeRenderFrameAtom } from "../../atoms/imagined-place-render.js"
import { placeBuildAtom, placeBuildingAtom, placeControlsAtom } from "../../atoms/imagined-place.js"
import { ActionButton } from "../primitives/ActionButton.js"
import { surfaceMaterials } from "../primitives/designSystem.js"
import { Layer, Section, Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { SkeletonSection } from "../primitives/Skeleton.js"
import { StageBanner } from "../primitives/StageBanner.js"

import { PlaceControls } from "./PlaceControls.js"
import { PlaceEvidence } from "./PlaceEvidence.js"
import { PlaceLineage } from "./PlaceLineage.js"
import { PlaceProposalCard } from "./PlaceProposalCard.js"
import { PlaceRenderColumn } from "./PlaceRenderColumn.js"

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

const Proposals = ({ build }: { readonly build: Option.Option<PlaceBuild> }) => {
  const controls = useAtomValue(placeControlsAtom)
  const setControls = useAtomSet(placeControlsAtom)
  const building = useAtomValue(placeBuildingAtom)

  return (
    <Stack className="gap-3">
      <SemanticText as="p" className="text-ink-900" role="row-label" text="Proposals" variant="compact" />
      {Option.match(build, {
        onNone: () => <SkeletonSection />,
        onSome: (value) => (
          <Layer className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {Arr.map(value.proposals, (record: ProposalRecord) => (
              <PlaceProposalCard
                accepted={accepts(controls, record.proposal.proposer)}
                disabled={building}
                key={record.proposal.proposer}
                note={record.proposal.proposer === value.evidence.sealedNote.from
                  ? Option.some(value.evidence.sealedNote)
                  : Option.none()}
                onToggle={() => {
                  setControls(toggled(controls, record.proposal.proposer))
                }}
                record={record}
              />
            ))}
          </Layer>
        )
      })}
    </Stack>
  )
}

const BuildFailed = () => {
  const retry = useAtomRefresh(placeBuildAtom)
  return (
    <StageBanner
      action={<ActionButton label="Try again" onClick={retry} />}
      text="The place could not be built."
      tone="error"
    />
  )
}

/**
 * The home-page demo: one imagined place, three participants. The server
 * composes, digests, signs and seals; this page draws. On small screens the
 * drawing comes first and the controls follow; from `lg` up the controls sit
 * left of a stage that stays in view while the proposals scroll.
 */
export const ImaginedPlaceDemo = () => {
  const result = useAtomValue(placeBuildAtom)
  const build = Result.value(result)
  const frame = Result.value(useAtomValue(placeRenderFrameAtom))

  return (
    <Section aria-label="Imagined place demo" className={`${surfaceMaterials.raisedCard} p-4 sm:p-7 lg:p-8`}>
      <Stack className="gap-6 lg:gap-8">
        <Stack className="gap-2">
          <SemanticText
            as="h2"
            className="text-ink-900"
            role="section-title"
            text="An imagined place"
            variant="expanded"
          />
          {Result.isFailure(result) ? <BuildFailed /> : null}
        </Stack>

        <Layer className="grid gap-6 lg:grid-cols-[minmax(18rem,21rem)_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:gap-x-10 lg:gap-y-8">
          <Layer className="order-2 lg:order-none lg:col-start-1 lg:row-start-1">
            <PlaceControls disabled={false} />
          </Layer>
          <Layer className="order-3 lg:order-none lg:col-start-1 lg:row-start-2">
            <Proposals build={build} />
          </Layer>
          <Stack className="order-1 min-w-0 gap-6 lg:sticky lg:top-6 lg:order-none lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
            <PlaceRenderColumn build={build} frame={frame} />
            {Option.match(build, {
              onNone: () => null,
              onSome: (value) => <PlaceLineage evidence={value.evidence} />
            })}
          </Stack>
        </Layer>

        {Option.match(build, {
          onNone: () => null,
          onSome: (value) => <PlaceEvidence build={value} frame={frame} />
        })}
      </Stack>
    </Section>
  )
}
