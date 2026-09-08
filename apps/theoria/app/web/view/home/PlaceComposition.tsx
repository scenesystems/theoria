import { Option } from "effect"
import * as Arr from "effect/Array"
import type { ReactNode } from "react"

import type { PlaceBuild } from "../../../contracts/imagined-place-result.js"
import type { PlaceFeature, PlaceOutline } from "../../../contracts/imagined-place.js"
import { inlineStatusToneFor, toneClassesFor } from "../primitives/designSystem.js"
import { Cluster, Layer, Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { GhostText } from "../primitives/Skeleton.js"

import { BriefField, ScenarioChoice } from "./PlaceControls.js"
import { inlineMarkClassName, inlineMarkRoomClassName, ProvenanceMark, StatusMark } from "./PlaceProvenance.js"
import { participantTone } from "./placeViewModel.js"

const authorTone = toneClassesFor(participantTone("author"))
const inferenceTone = inlineStatusToneFor("dsp")

/** A feature's place in the row: after the first, a dot stands before it. */
const FeatureSlot = ({ children, first }: { readonly children: ReactNode; readonly first: boolean }) => (
  <Layer render={<span />} className="inline-flex items-baseline gap-2">
    {first ? null : <Layer aria-hidden render={<span />} className="text-ink-400">·</Layer>}
    {children}
  </Layer>
)

/** A feature the composer named, said in the line in the author's accent: the same accent as its marker on the stage. */
const FeatureName = ({ feature, first }: { readonly feature: PlaceFeature; readonly first: boolean }) => (
  <FeatureSlot first={first}>
    <ProvenanceMark className={inlineMarkClassName} mark={{ _tag: "Feature", name: feature.name }}>
      <SemanticText as="span" className={authorTone.textStrong} role="selection-title" text={feature.name} />
    </ProvenanceMark>
  </FeatureSlot>
)

/** The room a feature's name takes before the build signs it: its words as a ghost, in the mark's padding. */
const FeatureNamePending = ({ feature, first }: { readonly feature: PlaceFeature; readonly first: boolean }) => (
  <FeatureSlot first={first}>
    <Layer render={<span />} className={inlineMarkRoomClassName}>
      <GhostText as="span" role="selection-title" text={feature.name} />
    </Layer>
  </FeatureSlot>
)

/**
 * The title the composer gave the place, under the story chosen and over the
 * brief it answers: the story's name, then its brief. While the build is
 * pending the outline's title stands here as a ghost, in the title's own
 * role and wrap, so the act does not change shape when the build's title
 * arrives in its place.
 */
const Title = ({ build, outline }: {
  readonly build: Option.Option<PlaceBuild>
  readonly outline: PlaceOutline
}) => (
  <Layer className="min-w-0" data-place-composition-title>
    {Option.match(build, {
      onNone: () => (
        <GhostText
          as="p"
          className="text-ink-900"
          role="card-title"
          text={outline.composition.title}
          variant="compact"
        />
      ),
      onSome: (value) => (
        <SemanticText
          as="p"
          className="text-ink-900"
          role="card-title"
          text={value.artifact.composition.title}
          variant="compact"
          wrapAuthority="native-browser"
        />
      )
    })}
  </Layer>
)

/**
 * The features the composer named from the brief, in the author's accent
 * because the author signs them. The row is labelled as what it is, beside
 * the status that is the honest part: the runtime is recorded, so the answer
 * is the one recorded for this scenario, checked against the output schema
 * each time. An edited brief is not explained here: the field shows it as
 * dirty, and version 1's digest changes because the brief is what it
 * signs. Before the build the outline's features stand in the row as ghosts,
 * so the row wraps as it will.
 */
const Features = ({ build, outline }: {
  readonly build: Option.Option<PlaceBuild>
  readonly outline: PlaceOutline
}) => (
  <Stack className="gap-2">
    <Layer className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
      <Layer render={<span />} data-place-features-label>
        <SemanticText as="span" className="text-ink-900" role="row-label" text="Features" variant="compact" />
      </Layer>
      <StatusMark label="Recorded inference" mark={{ _tag: "Inference" }} tone={inferenceTone} />
    </Layer>
    <Cluster className="gap-x-2 gap-y-1" data-place-features={Option.isSome(build) ? "built" : "pending"}>
      {Option.match(build, {
        onNone: () =>
          Arr.map(
            outline.composition.features,
            (feature, index) => <FeatureNamePending feature={feature} first={index === 0} key={feature.name} />
          ),
        onSome: (value) =>
          Arr.map(
            value.artifact.composition.features,
            (feature, index) => <FeatureName feature={feature} first={index === 0} key={feature.name} />
          )
      })}
    </Cluster>
  </Stack>
)

/**
 * The Compose act, read down: the stories to choose from, the title of the
 * one chosen, the brief that story gives the composer, and the features the
 * composer named from it.
 */
export const PlaceComposition = ({ build, outline }: {
  readonly build: Option.Option<PlaceBuild>
  readonly outline: PlaceOutline
}) => (
  <Stack className="gap-4" data-place-composition>
    <ScenarioChoice disabled={false} />
    <Title build={build} outline={outline} />
    <BriefField disabled={false} />
    <Features build={build} outline={outline} />
  </Stack>
)
