import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Option } from "effect"
import * as Arr from "effect/Array"

import type { PlaceBuild } from "../../../contracts/imagined-place-result.js"
import type { PlaceRenderFrame } from "../../atoms/imagined-place-render.js"
import {
  placeStageMaxDrawableAtom,
  placeStageMaxWidth,
  placeStagePresets,
  placeStageRequestAtom,
  placeStageWidthAtom
} from "../../atoms/imagined-place.js"
import { ChoicePills } from "../primitives/ChoicePills.js"
import { legendThemeFor, toneClassesFor } from "../primitives/designSystem.js"
import { Cluster, Layer, Stack } from "../primitives/Layout.js"
import { LegendItem } from "../primitives/LegendItem.js"
import { SemanticText } from "../primitives/SemanticText.js"

import { PlaceSearchTrace } from "./PlaceSearchTrace.js"
import { PlaceStage } from "./PlaceStage.js"
import {
  currentVersionText,
  drawablePresets,
  participantLabel,
  participants,
  participantTone,
  stagePresetLabel
} from "./placeViewModel.js"

const presetTone = toneClassesFor("text")

/**
 * The same version drawn for another screen. Only presets the column can show
 * are offered; when fewer than two fit there is nothing to choose.
 */
const StagePresets = () => {
  const setRequested = useAtomSet(placeStageRequestAtom)
  const drawn = useAtomValue(placeStageWidthAtom)
  const presets = drawablePresets(placeStagePresets, useAtomValue(placeStageMaxDrawableAtom))
  const activeIndex = Option.getOrElse(Arr.findFirstIndex(presets, (preset) => preset === drawn), () => -1)

  return presets.length === 0 ? null : (
    <Cluster className="items-center gap-2.5" data-place-presets>
      <SemanticText as="span" className="text-ink-500" role="code-meta" text="Drawn at" />
      <ChoicePills
        activeIndex={activeIndex}
        className="gap-1.5"
        disabled={false}
        onSelect={(index) => {
          // The last preset is the whole column: keep following it if the column changes.
          setRequested(
            index === presets.length - 1 ? placeStageMaxWidth : Option.getOrElse(Arr.get(presets, index), () => drawn)
          )
        }}
        options={Arr.map(presets, (preset, index) => ({ index, label: stagePresetLabel(preset) }))}
        tone={presetTone}
      />
    </Cluster>
  )
}

/** Who made what: the same three accents the markers, cards and pills use. */
const ParticipantLegend = () => (
  <Cluster className="gap-x-4 gap-y-1.5" data-place-legend-participants>
    {Arr.map(participants, (role) => (
      <LegendItem
        key={role}
        label={participantLabel(role)}
        shape="circle"
        theme={legendThemeFor(participantTone(role))}
      />
    ))}
  </Cluster>
)

/**
 * The title of the composition is projected text; it sits in its own grid
 * cell with a definite width so measuring it never depends on its siblings.
 * The version beside it does not change when the stage is redrawn: that is
 * the point of the presets.
 */
const TitleRow = ({ build }: { readonly build: PlaceBuild }) => (
  <Layer className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline">
    <SemanticText
      as="h3"
      className="min-w-0 text-ink-900"
      role="hero-body"
      text={build.artifact.composition.title}
      variant="compact"
      wrapAuthority="native-browser"
    />
    <Layer data-place-current-version>
      <SemanticText
        as="span"
        className="tabular-nums text-ink-500"
        role="code-meta"
        text={currentVersionText(build.evidence)}
      />
    </Layer>
  </Layer>
)

/** The Arrange step: the place drawn for this screen, and the search that arranged it. */
export const PlaceArrangement = ({
  build,
  frame
}: {
  readonly build: Option.Option<PlaceBuild>
  readonly frame: Option.Option<PlaceRenderFrame>
}) => (
  <Stack className="gap-4">
    {Option.match(build, {
      onNone: () => null,
      onSome: (value) => <TitleRow build={value} />
    })}
    <PlaceStage />
    <Layer className="grid grid-cols-1 items-center gap-x-6 gap-y-3 sm:grid-cols-[minmax(0,1fr)_auto]">
      {Option.match(frame, {
        onNone: () => <Layer />,
        onSome: (value) => <PlaceSearchTrace frame={value} />
      })}
      <StagePresets />
    </Layer>
    <ParticipantLegend />
  </Stack>
)
