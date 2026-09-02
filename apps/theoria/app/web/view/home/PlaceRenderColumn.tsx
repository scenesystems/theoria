import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Option } from "effect"

import type { PlaceBuild } from "../../../contracts/imagined-place-result.js"
import type { PlaceRenderFrame } from "../../atoms/imagined-place-render.js"
import {
  placeStageMinWidth,
  placeStageRequestAtom,
  placeStageSliderMaxAtom,
  placeStageWidthAtom
} from "../../atoms/imagined-place.js"
import { toneClassesFor } from "../primitives/designSystem.js"
import { Cluster, Layer, Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { SliderRow } from "../primitives/SliderRow.js"
import { StatusPill } from "../primitives/StatusPill.js"

import { PlaceStage } from "./PlaceStage.js"
import { currentVersionText, renderProgressText, stageSliderRangeMin } from "./placeViewModel.js"

const inferenceTone = toneClassesFor("dsp")

/** Hidden when the column is too narrow for the slider to change anything worth seeing. */
const StageWidthSlider = () => {
  const requested = useAtomValue(placeStageRequestAtom)
  const setRequested = useAtomSet(placeStageRequestAtom)
  const max = useAtomValue(placeStageSliderMaxAtom)
  const drawn = useAtomValue(placeStageWidthAtom)

  return max - placeStageMinWidth < stageSliderRangeMin ? null : (
    <SliderRow
      disabled={false}
      display={`${String(drawn)} px`}
      label="Stage width"
      layout="stacked"
      max={max}
      min={placeStageMinWidth}
      onChange={setRequested}
      step={1}
      tone={toneClassesFor("text")}
      value={Math.min(requested, max)}
    />
  )
}

/**
 * The title of the composition is projected text; it sits in its own grid
 * cell with a definite width so measuring it never depends on its siblings.
 */
const TitleRow = ({ build }: { readonly build: PlaceBuild }) => (
  <Layer className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline">
    <SemanticText
      as="h3"
      className="min-w-0 text-ink-900"
      role="hero-body"
      text={build.artifact.composition.title}
      variant="compact"
      wrapAuthority="native-browser"
    />
    <Cluster className="items-center gap-2">
      <StatusPill
        className={`border ${inferenceTone.borderSubtle} ${inferenceTone.bgTinted} ${inferenceTone.text}`}
        label="Recorded inference"
      />
      <SemanticText as="span" className="text-ink-500" role="code-meta" text={currentVersionText(build.evidence)} />
    </Cluster>
  </Layer>
)

/** The drawing, its title, live search progress and the width control. */
export const PlaceRenderColumn = ({
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
        onSome: (value) => (
          <Layer data-place-render-phase={value.phase}>
            <SemanticText
              as="span"
              className="tabular-nums text-ink-500"
              role="code-meta"
              text={renderProgressText(value)}
            />
          </Layer>
        )
      })}
      <Layer className="sm:w-56">
        <StageWidthSlider />
      </Layer>
    </Layer>
  </Stack>
)
