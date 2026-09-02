import { Button } from "@base-ui-components/react/button"
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Option } from "effect"
import * as Arr from "effect/Array"

import type { PlaceBuild } from "../../../contracts/imagined-place-result.js"
import { type PlaceRenderFrame, placeTrialPreviewAtom } from "../../atoms/imagined-place-render.js"
import {
  placeStageMaxDrawableAtom,
  placeStageMaxWidth,
  placeStagePresets,
  placeStageRequestAtom,
  placeStageWidthAtom,
  placeVersionChangeAtom
} from "../../atoms/imagined-place.js"
import { ChangedValue } from "../primitives/ChangedValue.js"
import { ChoicePills } from "../primitives/ChoicePills.js"
import { legendThemeFor, pillButtonClassName, toneClassesFor } from "../primitives/designSystem.js"
import { Cluster, Layer, Stack } from "../primitives/Layout.js"
import { LegendItem } from "../primitives/LegendItem.js"
import { SemanticText } from "../primitives/SemanticText.js"

import { ContentId } from "./ContentId.js"
import { PlaceSearchTrace } from "./PlaceSearchTrace.js"
import { PlaceStage } from "./PlaceStage.js"
import {
  currentVersion,
  currentVersionText,
  drawablePresets,
  keptTrialLabel,
  participantLabel,
  participants,
  participantTone,
  renderProgressText,
  shownTrialIndex,
  stagePresetLabel
} from "./placeViewModel.js"

const presetTone = toneClassesFor("text")
const searchTone = toneClassesFor("search")

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
 * The version beside it lights up when the record changes and stays still
 * when the stage is only redrawn: that is the point of the presets.
 */
const TitleRow = ({ build }: { readonly build: PlaceBuild }) => {
  const change = useAtomValue(placeVersionChangeAtom)
  return (
    <Layer className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline">
      <SemanticText
        as="h3"
        className="min-w-0 text-ink-900"
        role="hero-body"
        text={build.artifact.composition.title}
        variant="compact"
        wrapAuthority="native-browser"
      />
      <Layer className="min-w-0" data-place-current-version>
        <ChangedValue changes={change.changes} className="flex min-w-0 items-center gap-1.5">
          <SemanticText
            as="span"
            className="tabular-nums text-ink-500"
            role="code-meta"
            text={currentVersionText(build.evidence)}
          />
          {Option.match(currentVersion(build.evidence), {
            onNone: () => null,
            onSome: (version) => <ContentId form="short" id={version.contentId} />
          })}
        </ChangedValue>
      </Layer>
    </Layer>
  )
}

/**
 * Where the search stands, or which of its trials the stage is drawing. While
 * a rejected trial is drawn, the kept one is a click away.
 */
const SearchCaption = ({ frame }: { readonly frame: PlaceRenderFrame }) => {
  const shown = shownTrialIndex(frame, useAtomValue(placeTrialPreviewAtom))
  const setPreview = useAtomSet(placeTrialPreviewAtom)
  return (
    <Cluster className="min-w-0 items-center gap-2.5">
      <Layer className="min-w-0" data-place-search-caption>
        <SemanticText
          as="span"
          className="block truncate tabular-nums text-ink-500"
          role="code-meta"
          text={renderProgressText(frame, shown)}
        />
      </Layer>
      {shown === frame.bestIndex ? null : (
        <Button
          className={pillButtonClassName({ active: false, tone: searchTone })}
          data-place-show-kept
          onClick={() => {
            setPreview(Option.none())
          }}
          type="button"
        >
          <SemanticText
            as="span"
            className="text-ink-700"
            role="tab-label"
            text={keptTrialLabel(frame)}
            variant="expanded"
          />
        </Button>
      )}
    </Cluster>
  )
}

/**
 * The Arrange step: the place drawn for this screen, the search that arranged
 * it (every trial, any of which can be drawn), and who made what.
 */
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
    {Option.match(frame, {
      onNone: () => null,
      onSome: (value) => (
        <Stack className="gap-2">
          <PlaceSearchTrace frame={value} />
          <Cluster className="items-center justify-between gap-x-6 gap-y-3">
            <SearchCaption frame={value} />
            <StagePresets />
          </Cluster>
        </Stack>
      )
    })}
    <ParticipantLegend />
  </Stack>
)
