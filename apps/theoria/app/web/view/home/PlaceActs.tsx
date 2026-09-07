import { Result } from "@effect-atom/atom"
import { useAtomRefresh, useAtomValue } from "@effect-atom/atom-react"
import { Option } from "effect"

import type { PlaceBuild } from "../../../contracts/imagined-place-result.js"
import { placeBuildAtom, placeBuildEnvelopeAtom } from "../../atoms/imagined-place.js"
import { ActionButton } from "../primitives/ActionButton.js"
import { Layer, Section, Stack } from "../primitives/Layout.js"
import { ShimmerLine } from "../primitives/Skeleton.js"
import { StageBanner } from "../primitives/StageBanner.js"

import { imaginedPlaceSectionId } from "./HomeHero.js"
import { PlaceArrangement } from "./PlaceArrangement.js"
import { PlaceArrive } from "./PlaceArrive.js"
import { PlaceBand } from "./PlaceBand.js"
import { PlaceComposition } from "./PlaceComposition.js"
import { PlaceHowItsBuilt } from "./PlaceHowItsBuilt.js"
import { PlaceProposals } from "./PlaceProposals.js"
import { PlaceProvenanceOverlay } from "./PlaceProvenance.js"
import { PlaceStepCard } from "./PlaceStepCard.js"
import { PlaceStrand } from "./PlaceStrand.js"

const BuildFailed = () => {
  const retry = useAtomRefresh(placeBuildEnvelopeAtom)
  return (
    <StageBanner
      action={<ActionButton label="Try again" onClick={retry} />}
      text="The place could not be built."
      tone="error"
    />
  )
}

const Pending = () => (
  <Stack className="gap-2.5 pt-1">
    <ShimmerLine width="w-1/2" />
    <ShimmerLine width="w-3/4" />
  </Stack>
)

/**
 * The acts of the story on one spine — Compose, Propose, Record. Arrange is
 * the stage beside them, which is the reason the spine exists: each act
 * changes what the stage shows.
 */
const Acts = ({ build }: { readonly build: Option.Option<PlaceBuild> }) => (
  <Stack className="relative gap-10 lg:before:absolute lg:before:bottom-3 lg:before:left-[5px] lg:before:top-3 lg:before:w-px lg:before:bg-world-rule lg:before:transition-colors lg:before:duration-(--th-motion-duration-shift) lg:before:ease-theme">
    <PlaceStepCard spine="spine" step="compose">
      <PlaceComposition build={build} />
    </PlaceStepCard>
    <PlaceStepCard spine="spine" step="propose">
      <PlaceProposals build={build} />
    </PlaceStepCard>
    <PlaceStepCard spine="spine" step="record">
      {Option.match(build, {
        onNone: () => <Pending />,
        onSome: (value) => <PlaceStrand build={value} />
      })}
    </PlaceStepCard>
  </Stack>
)

/**
 * The demonstration: one imagined place and the account of how it was made.
 * Two columns from `lg` up: the reading column on the left carries the
 * arrival and the acts; the stage on the right is pinned and keeps the drawn
 * place in view while the acts scroll beside it. Below `lg` the arrival names
 * the place, the paper follows at full width, then the acts.
 */
export const PlaceActs = () => {
  const result = useAtomValue(placeBuildAtom)
  const build = Result.value(result)

  return (
    <Section aria-label="Imagined place demo" className="scroll-mt-6 pb-6" id={imaginedPlaceSectionId}>
      {/* The band's slot leads the demonstration so it can pin to the viewport for as long as the demonstration lasts. */}
      <Layer>
        <PlaceBand />
        <Stack className="gap-12 lg:gap-16">
          <Layer className="grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(24rem,1fr)_minmax(28rem,44rem)] lg:grid-rows-[auto_minmax(0,1fr)] lg:gap-y-10">
            <Layer className="min-w-0 lg:col-start-1 lg:row-start-1">
              <PlaceArrive />
              {Result.isFailure(result) ? <BuildFailed /> : null}
            </Layer>
            <Layer className="min-w-0 max-w-[44rem] lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:self-start lg:sticky lg:top-6">
              <PlaceStepCard spine="none" step="arrange">
                <PlaceArrangement build={build} />
              </PlaceStepCard>
            </Layer>
            <Layer className="min-w-0 lg:col-start-1 lg:row-start-2">
              <Acts build={build} />
            </Layer>
          </Layer>

          <PlaceHowItsBuilt />
        </Stack>
      </Layer>
      <PlaceProvenanceOverlay />
    </Section>
  )
}
