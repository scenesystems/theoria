import { ScrollArea } from "@base-ui/react/scroll-area"
import { Result } from "@effect-atom/atom"
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Option } from "effect"
import * as Arr from "effect/Array"
import * as Record from "effect/Record"
import type { CSSProperties } from "react"

import type { PlaceLine, PlaceMarker, PlaceProjection } from "../../../contracts/imagined-place-result.js"
import { useElementWidthReporter } from "../../atoms/element-observation.js"
import {
  type PlaceRenderFrame,
  placeRenderFrameAtom,
  placeShownFrameAtom,
  placeTrialPreviewAtom
} from "../../atoms/imagined-place-render.js"
import { placeStageContainerWidthAtom } from "../../atoms/imagined-place.js"
import { ArtifactStage } from "../primitives/ArtifactStage.js"
import { Cluster, Layer, Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { ShimmerLine } from "../primitives/Skeleton.js"

import { PlaceMarkerDisc } from "./PlaceMarker.js"
import { markerLabel, markerTone } from "./placeViewModel.js"
import { PlaceWalk } from "./PlaceWalk.js"

const stageFrameBorderPx = 1

const lineStyle = (line: PlaceLine, padding: number, lineHeight: number): CSSProperties => ({
  left: `${padding}px`,
  top: `${line.y}px`,
  width: `${line.maxWidth.toFixed(1)}px`,
  height: `${lineHeight}px`
})

/** The prose, one measured line at a time, above the walk and beside the discs. */
const Lines = ({ projection }: { readonly projection: PlaceProjection }) => (
  <>
    {Arr.map(projection.lines, (line, index) => (
      <Layer
        className="absolute overflow-hidden"
        data-place-line={String(index)}
        key={index}
        style={lineStyle(line, projection.padding, projection.lineHeight)}
      >
        <SemanticText
          as="span"
          className="block whitespace-nowrap text-ink-900"
          role="card-summary"
          text={line.text.length === 0 ? "\u00a0" : line.text}
          variant="expanded"
          wrapAuthority="native-browser"
        />
      </Layer>
    ))}
  </>
)

/**
 * The arrangement at its own size: the walk once the search settles, the discs
 * as buttons, the text above both. The discs are keyed by the trial drawn, so
 * swapping trials places them outright instead of sliding them, while the
 * search's own progress still moves them.
 */
const Drawing = ({ frame, shown }: { readonly frame: PlaceRenderFrame; readonly shown: string }) => {
  const projection = frame.rendering.projection
  return (
    <Layer
      aria-busy={frame.phase === "running"}
      className="relative"
      data-place-stage="content"
      data-place-stage-width={String(projection.stageWidth)}
      style={{ height: `${projection.stageHeight}px`, width: `${projection.stageWidth}px` }}
    >
      {frame.phase === "complete"
        ? <PlaceWalk height={projection.stageHeight} markers={projection.markers} width={projection.stageWidth} />
        : null}
      {Arr.map(projection.markers, (marker, index) => (
        <PlaceMarkerDisc
          index={index}
          key={`${shown}:${marker.name}`}
          labelWidth={Record.get(frame.labels, marker.name)}
          marker={marker}
        />
      ))}
      <Lines projection={projection} />
    </Layer>
  )
}

const paperClassName =
  "group/stage relative bg-radial-[at_20%_0%] from-stage-50 to-stage-0 transition-[height,width] duration-200 ease-out motion-reduce:transition-none"
const fadeClassName =
  "pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-linear-to-t from-stage-0 via-stage-0/85 to-transparent opacity-0 transition-opacity duration-200 group-data-[overflow-y-end]/stage:opacity-100 motion-reduce:transition-none"
const scrollbarClassName =
  "flex w-2 touch-none select-none p-px opacity-0 transition-opacity duration-200 group-data-[has-overflow-y]/stage:opacity-100"

/**
 * The stage is paper cut to the kept arrangement. The paper keeps that size
 * while another trial is drawn on it, so scrubbing the trace never moves the
 * trace: a trial that ran longer than the sheet is clipped with a fade and
 * scrolls, which is the same fact the search held against it.
 */
const Paper = ({
  frame,
  keptHeight,
  preview
}: {
  readonly frame: PlaceRenderFrame
  readonly keptHeight: number
  readonly preview: Option.Option<number>
}) => {
  const projection = frame.rendering.projection
  return (
    <ScrollArea.Root
      className={paperClassName}
      data-place-scrubbing={Option.isSome(preview) ? "" : undefined}
      data-place-stage="paper"
      data-place-stage-height={String(keptHeight)}
      style={{ height: `${keptHeight}px`, width: `${projection.stageWidth}px` }}
    >
      <ScrollArea.Viewport className="h-full w-full">
        <ScrollArea.Content>
          <Drawing frame={frame} shown={Option.match(preview, { onNone: () => "kept", onSome: String })} />
        </ScrollArea.Content>
      </ScrollArea.Viewport>
      <Layer className={fadeClassName} data-place-stage-fade />
      <ScrollArea.Scrollbar className={scrollbarClassName} orientation="vertical">
        <ScrollArea.Thumb className="flex-1 rounded-full bg-ink-700/35" />
      </ScrollArea.Scrollbar>
    </ScrollArea.Root>
  )
}

/** Shown only when markers are too small to carry their names: numbers on the stage, names here. */
const Legend = ({ markers }: { readonly markers: ReadonlyArray<PlaceMarker> }) => (
  <Cluster className="gap-x-3 gap-y-1.5" data-place-legend>
    {Arr.map(markers, (marker, index) => {
      const tone = markerTone(marker)
      return (
        <Cluster className="items-center gap-1.5" key={marker.name}>
          <Layer as="span" className={`inline-flex size-2 shrink-0 rounded-full ${tone.dot}`} />
          <SemanticText
            as="span"
            className="text-ink-700"
            role="code-meta"
            text={`${String(index + 1)} ${markerLabel(marker)}`}
          />
        </Cluster>
      )
    })}
  </Cluster>
)

const Placeholder = () => (
  <Stack className="gap-3 p-4">
    <ShimmerLine width="w-4/5" />
    <ShimmerLine width="w-3/5" />
    <ShimmerLine width="w-2/3" />
  </Stack>
)

/** Discs are named or numbered as a set; the legend accompanies the numbers. */
const numbered = (frame: PlaceRenderFrame): boolean => Record.isEmptyRecord(frame.labels)

/**
 * The place drawn at the stage width the visitor chose. The description flows
 * around the features; features from merged proposals keep their proposer's
 * accent. The drawing is presentation only: none of it is digested, so the
 * width changes what you see and nothing else.
 */
export const PlaceStage = () => {
  const preview = useAtomValue(placeTrialPreviewAtom)
  const reportContainerWidth = useElementWidthReporter(useAtomSet(placeStageContainerWidthAtom))
  const latest = Result.value(useAtomValue(placeShownFrameAtom))
  // The paper is cut to the kept arrangement even while another trial is drawn on it.
  const keptHeight = Option.map(
    Result.value(useAtomValue(placeRenderFrameAtom)),
    (kept) => kept.rendering.projection.stageHeight
  )
  // The frame is cut to the drawn stage; before a frame exists, the placeholder sizes it.
  const frameStyle = Option.match(latest, {
    onNone: () => ({}),
    onSome: (value) => ({ width: `${value.rendering.projection.stageWidth + stageFrameBorderPx * 2}px` })
  })

  return (
    <Stack className="gap-3">
      <Layer>
        <ArtifactStage
          frameStyle={frameStyle}
          viewportClassName="justify-center"
          viewportRef={reportContainerWidth}
        >
          {Option.match(latest, {
            onNone: () => <Placeholder />,
            onSome: (value) => (
              <Paper
                frame={value}
                keptHeight={Option.getOrElse(keptHeight, () => value.rendering.projection.stageHeight)}
                preview={preview}
              />
            )
          })}
        </ArtifactStage>
      </Layer>
      {Option.match(latest, {
        onNone: () => null,
        onSome: (value) =>
          numbered(value)
            ? <Legend markers={value.rendering.projection.markers} />
            : null
      })}
    </Stack>
  )
}
