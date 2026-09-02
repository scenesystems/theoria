import { Result } from "@effect-atom/atom"
import { useAtomRefresh, useAtomValue } from "@effect-atom/atom-react"
import { Option } from "effect"

import type { PlaceBuild } from "../../../contracts/imagined-place-result.js"
import { placeRenderFrameAtom } from "../../atoms/imagined-place-render.js"
import { placeBuildAtom, placeBuildEnvelopeAtom } from "../../atoms/imagined-place.js"
import { ActionButton } from "../primitives/ActionButton.js"
import { surfaceMaterials } from "../primitives/designSystem.js"
import { Layer, Section, Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { ShimmerLine } from "../primitives/Skeleton.js"
import { StageBanner } from "../primitives/StageBanner.js"

import { PlaceArrangement } from "./PlaceArrangement.js"
import { PlaceComposition } from "./PlaceComposition.js"
import { PlaceHowItsBuilt } from "./PlaceHowItsBuilt.js"
import { PlaceLineage } from "./PlaceLineage.js"
import { PlaceProposals } from "./PlaceProposals.js"
import { PlaceStepCard } from "./PlaceStepCard.js"

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
 * The story runs down the left as three steps on one spine — Compose,
 * Propose, Record — and the fourth, Arrange, is the stage on the right, which
 * stays in view while the steps scroll past it. On small screens the stage
 * comes first and the steps follow.
 */
const Steps = ({ build }: { readonly build: Option.Option<PlaceBuild> }) => (
  <Stack className="relative gap-8 lg:before:absolute lg:before:bottom-3 lg:before:left-[5px] lg:before:top-3 lg:before:w-px lg:before:bg-stage-300/90">
    <PlaceStepCard step="compose">
      <PlaceComposition build={build} />
    </PlaceStepCard>
    <PlaceStepCard step="propose">
      <PlaceProposals build={build} />
    </PlaceStepCard>
    <PlaceStepCard step="record">
      {Option.match(build, {
        onNone: () => <Pending />,
        onSome: (value) => <PlaceLineage build={value} />
      })}
    </PlaceStepCard>
  </Stack>
)

/**
 * The home-page demo: one imagined place, three participants, four steps. The
 * server composes, digests, signs and seals; this page draws.
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
          <SemanticText
            as="p"
            className="max-w-[60ch] text-ink-600"
            role="card-summary"
            text="You brief it, a program composes it, a neighbor and a program propose, you decide what to merge, and the page draws the version you signed."
            variant="compact"
            wrapAuthority="native-browser"
          />
          {Result.isFailure(result) ? <BuildFailed /> : null}
        </Stack>

        <Layer className="grid gap-8 lg:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)] lg:gap-x-10">
          <Layer className="order-2 min-w-0 lg:order-none">
            <Steps build={build} />
          </Layer>
          <Layer className="order-1 min-w-0 lg:sticky lg:top-6 lg:order-none lg:self-start">
            <PlaceStepCard step="arrange">
              <PlaceArrangement build={build} frame={frame} />
            </PlaceStepCard>
          </Layer>
        </Layer>

        <PlaceHowItsBuilt />
      </Stack>
    </Section>
  )
}
