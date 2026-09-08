import { Button } from "@base-ui/react/button"
import { Result } from "@effect-atom/atom"
import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Option } from "effect"
import * as Arr from "effect/Array"

import type { PlaceBuild } from "../../../contracts/imagined-place-result.js"
import type { PlaceOutline } from "../../../contracts/imagined-place.js"
import {
  drawingId,
  type PlaceRenderError,
  placeRenderFrameAtom,
  type PlaceSearch,
  placeSearchAtom,
  placeTrialPreviewAtom
} from "../../atoms/imagined-place-render.js"
import {
  placeStageMaxDrawableAtom,
  placeStageMaxWidth,
  placeStagePresets,
  placeStageRequestAtom,
  placeStageWidthAtom
} from "../../atoms/imagined-place.js"
import { ActionButton } from "../primitives/ActionButton.js"
import { ChoiceGroup } from "../primitives/ChoiceGroup.js"
import { pillButtonClassName, toneClassesFor } from "../primitives/designSystem.js"
import { Cluster, Layer, Rail, Stack } from "../primitives/Layout.js"
import { LegendItem } from "../primitives/LegendItem.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { GhostText } from "../primitives/Skeleton.js"
import { StageBanner } from "../primitives/StageBanner.js"

import { inlineMarkClassName, inlineMarkRoomClassName, ProvenanceMark } from "./PlaceProvenance.js"
import { PlaceSearchTrace, PlaceSearchTracePending } from "./PlaceSearchTrace.js"
import { PlaceStage } from "./PlaceStage.js"
import { StageKnots } from "./PlaceStrand.js"
import {
  drawablePresets,
  keptTrialLabel,
  participantLabel,
  participantTone,
  presentParticipants,
  renderProgressText,
  searchCaptionShape,
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
      <ChoiceGroup
        activeIndex={activeIndex}
        className="gap-1.5"
        disabled={false}
        label="Stage width"
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

/**
 * Who made what in the version drawn: the same accents the markers, cards and
 * pills use. A proposer appears only while a proposal of theirs is merged.
 * Read from the outline, so the legend is here before the build is.
 */
const ParticipantLegend = ({ outline }: { readonly outline: PlaceOutline }) => (
  <Cluster className="gap-x-4 gap-y-1.5" data-place-legend-participants>
    {Arr.map(presentParticipants(outline), (role) => (
      <LegendItem
        key={role}
        label={participantLabel(role)}
        tone={toneClassesFor(participantTone(role))}
      />
    ))}
  </Cluster>
)

/**
 * Where the search stands, or which of its trials the stage is drawing. While
 * a rejected trial is drawn, the kept one is a click away. The row is always
 * as tall as that pill and never wraps, so choosing a trial cannot move the
 * trace under the pointer.
 */
const SearchCaption = ({ search }: { readonly search: PlaceSearch }) => {
  const shown = shownTrialIndex(search, useAtomValue(placeTrialPreviewAtom))
  const setPreview = useAtomSet(placeTrialPreviewAtom)
  return (
    <Rail className="min-h-9 min-w-0 gap-2.5">
      <ProvenanceMark
        className={inlineMarkClassName}
        data-place-search-caption
        mark={{ _tag: "Trial", index: shown, drawing: drawingId(search) }}
      >
        <SemanticText
          as="span"
          className="block truncate tabular-nums text-ink-500"
          role="code-meta"
          text={renderProgressText(search, shown)}
        />
      </ProvenanceMark>
      {shown === search.bestIndex ? null : (
        <Button
          className={`shrink-0 ${pillButtonClassName({ active: false, tone: searchTone })}`}
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
            text={keptTrialLabel(search)}
            variant="expanded"
          />
        </Button>
      )}
    </Rail>
  )
}

/** The caption's row before the search has started: its words as a ghost in the mark's room, at the row's height. */
const SearchCaptionPending = () => (
  <Rail aria-busy className="min-h-9 min-w-0 gap-2.5" data-place-search-caption-pending>
    <Layer render={<span />} className={inlineMarkRoomClassName}>
      <GhostText as="span" className="tabular-nums text-ink-500" role="code-meta" text={searchCaptionShape} />
    </Layer>
  </Rail>
)

/**
 * The trace and, under it, the caption and the widths to draw at. The rows
 * are the same before the search has started, with the trace's chart and the
 * caption's words as the room they will take; the widths are known from the
 * column and are offered from the first frame.
 */
const SearchRows = ({ search }: { readonly search: Option.Option<PlaceSearch> }) => (
  <Stack className="gap-2">
    {Option.match(search, {
      onNone: () => <PlaceSearchTracePending />,
      onSome: (value) => <PlaceSearchTrace search={value} />
    })}
    <Layer className="grid grid-cols-1 items-center gap-x-6 gap-y-3 @2xl:grid-cols-[minmax(0,1fr)_auto]">
      {Option.match(search, {
        onNone: () => <SearchCaptionPending />,
        onSome: (value) => <SearchCaption search={value} />
      })}
      <StagePresets />
    </Layer>
  </Stack>
)

/**
 * The search that draws the place failed; the last frame it reached stays on
 * the stage until it is run again. While the run it asked for is under way
 * the failure is still shown, `waiting`, and the button rests: another click
 * would only cancel that run and start over.
 */
const DrawFailed = ({ search }: { readonly search: Result.Failure<PlaceSearch, PlaceRenderError> }) => {
  const redraw = useAtomRefresh(placeRenderFrameAtom)
  return (
    <StageBanner
      action={<ActionButton disabled={search.waiting} label="Draw again" onClick={redraw} />}
      text={search.waiting ? "Drawing the place again." : "The place could not be drawn."}
      tone="error"
    />
  )
}

/**
 * The Arrange step: the place drawn for this screen, the search that arranged
 * it (every trial, any of which can be drawn), and who made what. Rows inside
 * decide their shape by this column's width, not the viewport's: the column
 * is narrower beside the steps than it is above them.
 */
export const PlaceArrangement = ({ build, outline }: {
  readonly build: Option.Option<PlaceBuild>
  readonly outline: PlaceOutline
}) => {
  const search = useAtomValue(placeSearchAtom)
  return (
    <Stack className="@container gap-4">
      <StageKnots evidence={Option.map(build, (value) => value.evidence)} outline={outline} />
      <PlaceStage />
      {Result.isFailure(search) ? <DrawFailed search={search} /> : null}
      {Result.isFailure(search) && Option.isNone(Result.value(search)) ?
        null :
        <SearchRows search={Result.value(search)} />}
      <ParticipantLegend outline={outline} />
    </Stack>
  )
}
