import { ScrollArea } from "@base-ui/react/scroll-area"
import { Result } from "@effect-atom/atom"
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Match, Option } from "effect"
import * as Arr from "effect/Array"
import * as Record from "effect/Record"
import { AnimatePresence } from "motion/react"
import * as m from "motion/react-m"
import type { CSSProperties } from "react"

import type { PlaceLine, PlaceMarker, PlaceProjection } from "../../../contracts/imagined-place-result.js"
import { useElementWidthReporter } from "../../atoms/element-observation.js"
import {
  type PlaceDrawn,
  placeDrawnAtom,
  type PlaceRenderFrame,
  type PlaceSheet,
  placeSheetAtom,
  placeShownFrameAtom,
  placeTrialPreviewAtom
} from "../../atoms/imagined-place-render.js"
import { placeStageContainerWidthAtom, placeStageFrame, placeStageFrameBorderPx } from "../../atoms/imagined-place.js"
import { ArtifactStage } from "../primitives/ArtifactStage.js"
import { Cluster, Layer, Stack } from "../primitives/Layout.js"
import { arrivalFrom, arrivedAt, departed, exitTransition, staggeredArrival } from "../primitives/motion.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { ShimmerLine } from "../primitives/Skeleton.js"

import { PlaceMarkerDisc } from "./PlaceMarker.js"
import { markerLabel, markerTone } from "./placeViewModel.js"
import { PlaceWalk } from "./PlaceWalk.js"

const lineStyle = (line: PlaceLine, padding: number, lineHeight: number): CSSProperties => ({
  left: `${padding}px`,
  top: `${line.y}px`,
  width: `${line.maxWidth.toFixed(1)}px`,
  height: `${lineHeight}px`
})

/**
 * The prose, one measured line at a time, above the walk and beside the
 * discs. The set of lines is keyed by the text it sets: when a merge or a
 * decline changes the description, the old lines leave together first and
 * then the new ones arrive one after another from the top, so two texts are
 * never painted over each other, and the words are settled before anything
 * travelling to the stage lands.
 */
const Lines = ({ projection, prose }: { readonly projection: PlaceProjection; readonly prose: string }) => (
  <AnimatePresence initial={false} mode="wait">
    <Layer
      render={<m.div exit={departed} transition={exitTransition} />}
      className="absolute inset-0"
      data-place-lines
      key={prose}
    >
      {Arr.map(projection.lines, (line, index) => (
        <Layer
          render={<m.div animate={arrivedAt} initial={arrivalFrom} transition={staggeredArrival(index)} />}
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
    </Layer>
  </AnimatePresence>
)

/**
 * The arrangement at its own size: the walk once the search settles, the discs
 * as buttons, the text above both. The discs are keyed by the trial drawn, so
 * swapping trials places them outright, while the search's own progress moves
 * the same discs.
 */
const Drawing = ({ frame, shown }: {
  readonly frame: PlaceRenderFrame
  readonly shown: string
}) => {
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
      <Lines projection={projection} prose={frame.prose} />
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
 * The kept arrangement fits the sheet, so the sheet's edge is not a clip:
 * a disc travelling in from its proposal crosses it whole. Anything else
 * drawn (the search's sketch, a trial from the trace) may run longer than
 * the sheet and is cut at its edge with a fade, and scrolls. Base UI sets the
 * viewport to scroll inline, so the kept case is set the same way.
 */
const viewportStyle = (drawn: PlaceDrawn): CSSProperties =>
  Match.value(drawn).pipe(
    Match.when("kept", (): CSSProperties => ({ overflow: "visible" })),
    Match.when("sketch", (): CSSProperties => ({})),
    Match.when("trial", (): CSSProperties => ({})),
    Match.exhaustive
  )

/**
 * The stage is paper cut to the kept arrangement (`placeSheetAtom`). The paper
 * keeps that size while the next search runs and while another trial is
 * drawn on it, so nothing around the stage moves until the arrangement is
 * settled, and scrubbing the trace never moves the trace: a sketch or a trial
 * that runs longer than the sheet is clipped with a fade and scrolls, which
 * is the same fact the search holds against it.
 */
const Paper = ({
  drawn,
  frame,
  sheet,
  shown
}: {
  readonly drawn: PlaceDrawn
  readonly frame: PlaceRenderFrame
  readonly sheet: PlaceSheet
  readonly shown: string
}) => (
  <ScrollArea.Root
    className={paperClassName}
    data-place-drawn={drawn}
    data-place-stage="paper"
    data-place-stage-height={String(sheet.height)}
    style={{ height: `${sheet.height}px`, width: `${sheet.width}px` }}
  >
    <ScrollArea.Viewport className="h-full w-full" style={viewportStyle(drawn)}>
      <ScrollArea.Content>
        <Drawing frame={frame} shown={shown} />
      </ScrollArea.Content>
    </ScrollArea.Viewport>
    <Layer className={fadeClassName} data-place-stage-fade />
    <ScrollArea.Scrollbar className={scrollbarClassName} orientation="vertical">
      <ScrollArea.Thumb className="flex-1 rounded-full bg-ink-700/35" />
    </ScrollArea.Scrollbar>
  </ScrollArea.Root>
)

/** Shown only when markers are too small to carry their names: numbers on the stage, names here. */
const Legend = ({ markers }: { readonly markers: ReadonlyArray<PlaceMarker> }) => (
  <Cluster className="gap-x-3 gap-y-1.5" data-place-legend>
    {Arr.map(markers, (marker, index) => {
      const tone = markerTone(marker)
      return (
        <Cluster className="items-center gap-1.5" key={marker.name}>
          <Layer render={<span />} className={`inline-flex size-2 shrink-0 rounded-full ${tone.dot}`} />
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
  const drawn = useAtomValue(placeDrawnAtom)
  const sheet = useAtomValue(placeSheetAtom)
  const reportContainerWidth = useElementWidthReporter(useAtomSet(placeStageContainerWidthAtom))
  const latest = Result.value(useAtomValue(placeShownFrameAtom))
  // The frame is cut to the sheet; before a frame exists, the placeholder sizes it.
  const frameStyle = Option.match(sheet, {
    onNone: () => ({}),
    onSome: (value) => ({ width: `${value.width + placeStageFrameBorderPx * 2}px` })
  })

  return (
    <Stack className="gap-3">
      <Layer data-place-stage="column">
        <ArtifactStage
          frame={placeStageFrame}
          frameStyle={frameStyle}
          viewportClassName="justify-center"
          viewportRef={reportContainerWidth}
        >
          {Option.match(Option.all({ frame: latest, sheet }), {
            onNone: () => <Placeholder />,
            onSome: (value) => (
              <Paper
                drawn={drawn}
                frame={value.frame}
                sheet={value.sheet}
                shown={Option.match(preview, { onNone: () => "kept", onSome: String })}
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
