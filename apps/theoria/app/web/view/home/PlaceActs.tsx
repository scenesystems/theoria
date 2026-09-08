import { Result } from "@effect-atom/atom"
import { useAtomValue } from "@effect-atom/atom-react"
import type { Option } from "effect"

import type { PlaceBuild } from "../../../contracts/imagined-place-result.js"
import type { OfferedProposal, PlaceOutline } from "../../../contracts/imagined-place.js"
import { placeBuildAtom, placeOfferedAtom, placeOutlineAtom } from "../../atoms/imagined-place.js"
import { Layer, Section, Stack } from "../primitives/Layout.js"

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

/**
 * The acts of the story on one spine — Compose, Propose, Record. Arrange is
 * the stage beside them, which is the reason the spine exists: each act
 * changes what the stage shows. Each act is laid out from the outline — what
 * the recording says the build will say — and filled in from the build, so
 * the acts take their height from their first frame.
 */
const Acts = ({ build, offered, outline }: {
  readonly build: Option.Option<PlaceBuild>
  readonly offered: ReadonlyArray<OfferedProposal>
  readonly outline: PlaceOutline
}) => (
  <Stack
    className="relative gap-10 lg:before:absolute lg:before:bottom-3 lg:before:left-[calc(0.375rem-0.5px)] lg:before:top-3 lg:before:w-px lg:before:bg-rule-strong"
    data-place-acts
  >
    <PlaceStepCard spine="spine" step="compose">
      <PlaceComposition build={build} outline={outline} />
    </PlaceStepCard>
    <PlaceStepCard spine="spine" step="propose">
      <PlaceProposals build={build} offered={offered} outline={outline} />
    </PlaceStepCard>
    <PlaceStepCard spine="spine" step="record">
      <PlaceStrand build={build} offered={offered} outline={outline} />
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
  const outline = useAtomValue(placeOutlineAtom)
  const offered = useAtomValue(placeOfferedAtom)

  return (
    <Section aria-label="Imagined place demo" className="scroll-mt-6 pb-6" id={imaginedPlaceSectionId}>
      {/* The band's slot leads the demonstration so it can pin to the viewport for as long as the demonstration lasts. */}
      <Layer>
        <PlaceBand />
        <Stack className="gap-12 lg:gap-16">
          <Stack className="gap-8">
            <Stack className="min-w-0 max-w-[44rem] gap-6">
              <PlaceArrive />
            </Stack>
            <Layer className="grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(24rem,1fr)_minmax(28rem,44rem)]">
              {/* The stage column is the grid track's at `lg` and the section's below it: the paper takes the column up to `stageMaxWidth`, and is centred in it, at every width. */}
              <Layer className="min-w-0 lg:col-start-2 lg:row-start-1 lg:self-start lg:sticky lg:top-6">
                <PlaceStepCard spine="none" step="arrange">
                  <PlaceArrangement build={build} outline={outline} />
                </PlaceStepCard>
              </Layer>
              <Layer className="min-w-0 lg:col-start-1 lg:row-start-1">
                <Acts build={build} offered={offered} outline={outline} />
              </Layer>
            </Layer>
          </Stack>

          <PlaceHowItsBuilt />
        </Stack>
      </Layer>
      <PlaceProvenanceOverlay />
    </Section>
  )
}
