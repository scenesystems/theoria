import { Option } from "effect"
import * as Arr from "effect/Array"

import type { PlaceBuild } from "../../../contracts/imagined-place-result.js"
import type { PlaceFeature } from "../../../contracts/imagined-place.js"
import { inlineStatusToneFor, toneClassesFor } from "../primitives/designSystem.js"
import { Cluster, Layer, Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { ShimmerText } from "../primitives/Skeleton.js"

import { BriefField, ScenarioChoice } from "./PlaceControls.js"
import { inlineMarkClassName, ProvenanceMark, StatusMark } from "./PlaceProvenance.js"
import { participantTone } from "./placeViewModel.js"

const authorTone = toneClassesFor(participantTone("author"))
const inferenceTone = inlineStatusToneFor("dsp")

/** A feature the composer named, said in the line in the author's accent: the same accent as its marker on the stage. */
const FeatureName = ({ feature, first }: { readonly feature: PlaceFeature; readonly first: boolean }) => (
  <Layer render={<span />} className="inline-flex items-baseline gap-2">
    {first ? null : <Layer aria-hidden render={<span />} className="text-ink-400">·</Layer>}
    <ProvenanceMark className={inlineMarkClassName} mark={{ _tag: "Feature", name: feature.name }}>
      <SemanticText as="span" className={authorTone.textStrong} role="selection-title" text={feature.name} />
    </ProvenanceMark>
  </Layer>
)

/**
 * The title the composer gave the place, under the story chosen and over the
 * brief it answers: the story's name, then its brief. While the build is
 * pending a line shimmers in the title's own role, so the line box is the
 * title's and the act does not change shape when the title arrives.
 */
const Title = ({ build }: { readonly build: Option.Option<PlaceBuild> }) =>
  Option.match(build, {
    onNone: () => <ShimmerText role="card-title" width="w-1/2" />,
    onSome: (value) => (
      <Layer className="min-w-0" data-place-composition-title>
        <SemanticText
          as="p"
          className="text-ink-900"
          role="card-title"
          text={value.artifact.composition.title}
          variant="compact"
          wrapAuthority="native-browser"
        />
      </Layer>
    )
  })

/**
 * The features the composer named from the brief, in the author's accent
 * because the author signs them. The row is labelled as what it is, beside
 * the status that is the honest part: the runtime is recorded, so the answer
 * is the one recorded for this scenario, checked against the output schema
 * each time. An edited brief is not explained here: the field shows it as
 * dirty, and version 1's digest changes because the brief is what it
 * signs.
 */
const Features = ({ build }: { readonly build: Option.Option<PlaceBuild> }) => (
  <Stack className="gap-2">
    <Layer className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
      <Layer render={<span />} data-place-features-label>
        <SemanticText as="span" className="text-ink-900" role="row-label" text="Features" variant="compact" />
      </Layer>
      <StatusMark label="Recorded inference" mark={{ _tag: "Inference" }} tone={inferenceTone} />
    </Layer>
    {Option.match(build, {
      onNone: () => <ShimmerText role="selection-title" width="w-4/5" />,
      onSome: (value) => (
        <Cluster className="gap-x-2 gap-y-1" data-place-features>
          {Arr.map(
            value.artifact.composition.features,
            (feature, index) => <FeatureName feature={feature} first={index === 0} key={feature.name} />
          )}
        </Cluster>
      )
    })}
  </Stack>
)

/**
 * The Compose act, read down: the stories to choose from, the title of the
 * one chosen, the brief that story gives the composer, and the features the
 * composer named from it.
 */
export const PlaceComposition = ({ build }: { readonly build: Option.Option<PlaceBuild> }) => (
  <Stack className="gap-4" data-place-composition>
    <ScenarioChoice disabled={false} />
    <Title build={build} />
    <BriefField disabled={false} />
    <Features build={build} />
  </Stack>
)
