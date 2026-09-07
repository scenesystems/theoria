import { ScrollArea } from "@base-ui/react/scroll-area"
import { Toolbar } from "@base-ui/react/toolbar"
import { Result } from "@effect-atom/atom"
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Match, Option } from "effect"
import * as Arr from "effect/Array"
import * as Record from "effect/Record"
import { AnimatePresence } from "motion/react"
import * as m from "motion/react-m"
import type { CSSProperties } from "react"

import { stageFor } from "../../../contracts/demo/imagined-place-flow.js"
import { type DrawingId, placeSourceId } from "../../../contracts/demo/imagined-place-provenance.js"
import type { PlaceLine, PlaceMarker, PlaceProjection } from "../../../contracts/imagined-place-result.js"
import { useElementWidthReporter } from "../../atoms/element-observation.js"
import { placeActAtom } from "../../atoms/imagined-place-experience.js"
import {
  drawingId,
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
import { litMarkClassName, markClassName } from "../primitives/designSystem.js"
import { Cluster, Layer, Stack } from "../primitives/Layout.js"
import { departed, exitTransition, staggeredArrival } from "../primitives/motion.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { ShimmerLine } from "../primitives/Skeleton.js"

import { PlaceGhosts } from "./PlaceGhosts.js"
import { PlaceMarkerDisc } from "./PlaceMarker.js"
import { ProvenanceMark } from "./PlaceProvenance.js"
import { markerLabel, markerTone, searching } from "./placeViewModel.js"
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
 * travelling to the stage lands. A line arrives in place, without the rise
 * everything else arriving takes: its place is the room the discs leave it,
 * and a line arriving from four pixels low would cross into a disc below.
 */
const lineArrivalFrom = { opacity: 0 }
const lineArrivedAt = { opacity: 1 }

/**
 * Each line of prose is a mark: resting on it, or pressing it, says how the
 * line was set, in words the layout engine chose. The lines are one stop in
 * the tab order — a vertical toolbar, so the arrows move between lines and
 * Enter opens the line's answer — and the prose still reads in order. While
 * answered, whether pointed at itself or through the code that set it or the
 * proposal whose sentence stands on it, the line wears a faint wash. The
 * lines' sheet itself lets the pointer through to the discs beneath it; only
 * the lines take it.
 */
const lineClassName = `${markClassName} ${litMarkClassName} pointer-events-auto absolute overflow-hidden`

const Lines = ({ drawing, projection, prose }: {
  readonly drawing: DrawingId
  readonly projection: PlaceProjection
  readonly prose: string
}) => (
  <AnimatePresence initial={false} mode="wait">
    <Toolbar.Root
      render={<m.div exit={departed} transition={exitTransition} />}
      aria-label="Lines of the prose"
      className="pointer-events-none absolute inset-0"
      data-place-lines
      key={prose}
      loopFocus={false}
      orientation="vertical"
    >
      {Arr.map(projection.lines, (line, index) => (
        <Toolbar.Button
          render={
            <ProvenanceMark
              render={<m.div animate={lineArrivedAt} initial={lineArrivalFrom} transition={staggeredArrival(index)} />}
              mark={{ _tag: "Line", index, drawing }}
              nativeButton={false}
            />
          }
          className={lineClassName}
          data-place-line={String(index)}
          key={index}
          nativeButton={false}
          style={lineStyle(line, projection.padding, projection.lineHeight)}
        >
          <SemanticText
            as="span"
            className="block whitespace-nowrap text-ink-900"
            role="stage-prose"
            text={line.text.length === 0 ? "\u00a0" : line.text}
            variant="expanded"
            wrapAuthority="native-browser"
          />
        </Toolbar.Button>
      ))}
    </Toolbar.Root>
  </AnimatePresence>
)

/**
 * The arrangement at its own size: the walk once the search settles, the discs
 * as buttons, the text above both. The discs are keyed by the trial drawn, so
 * swapping trials places them outright, while the search's own progress moves
 * the same discs. A disc whose feature leaves the drawing — declined, or gone
 * with the scenario — fades where it stood. The drawing carries the act being
 * read, which its discs and ghosts answer.
 */
const Drawing = ({ frame, shown }: {
  readonly frame: PlaceRenderFrame
  readonly shown: string
}) => {
  const projection = frame.rendering.projection
  const act = useAtomValue(placeActAtom)
  return (
    <Layer
      aria-busy={searching(frame.search)}
      className="relative"
      data-place-stage-act={act}
      data-place-stage="content"
      data-place-stage-width={String(projection.stageWidth)}
      style={{ height: `${projection.stageHeight}px`, width: `${projection.stageWidth}px` }}
    >
      {frame.search.phase === "complete"
        ? <PlaceWalk height={projection.stageHeight} markers={projection.markers} width={projection.stageWidth} />
        : null}
      <AnimatePresence initial={false}>
        {Arr.map(projection.markers, (marker, index) => (
          <PlaceMarkerDisc
            index={index}
            key={`${shown}:${marker.name}`}
            labelWidth={Record.get(frame.search.labels, marker.name)}
            marker={marker}
            source={placeSourceId(frame.search.source)}
          />
        ))}
      </AnimatePresence>
      <PlaceGhosts padding={projection.padding} stageWidth={projection.stageWidth} />
      <Lines
        drawing={drawingId(frame.search)}
        projection={projection}
        prose={frame.search.prose}
      />
    </Layer>
  )
}

/**
 * The paper's height is moved by the frames themselves, so nothing is added
 * to it; its width is recut in one step when the visitor chooses another, and
 * eases there. Its colour is the stage's own and the same in every story, so
 * choosing another place changes the drawing and nothing of the page around it.
 */
const paperClassName =
  "group/stage relative bg-radial-[at_20%_0%] from-stage-50 to-stage-0 transition-[width] duration-200 ease-out motion-reduce:transition-none"
const fadeClassName =
  "pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-linear-to-t from-stage-0 via-stage-0/85 to-transparent opacity-0 transition-opacity duration-200 group-data-[overflow-y-end]/stage:opacity-100 motion-reduce:transition-none"
const scrollbarClassName =
  "flex w-2 touch-none select-none p-px opacity-0 transition-opacity duration-200 group-data-[has-overflow-y]/stage:opacity-100"

/**
 * The kept arrangement fits the sheet, so the sheet's edge is not a clip:
 * a disc travelling in from its proposal crosses it whole, and there is no
 * fade and no scrollbar. Anything else drawn (the search's sketch, a trial
 * from the trace) may run longer than the sheet and is cut at its edge with
 * a fade, and scrolls.
 */
const cut = (drawn: PlaceDrawn): boolean =>
  Match.value(drawn).pipe(
    Match.when("kept", () => false),
    Match.when("sketch", () => true),
    Match.when("trial", () => true),
    Match.exhaustive
  )

/** Base UI sets the viewport to scroll inline, so the uncut case is set the same way. */
const viewportStyle = (drawn: PlaceDrawn): CSSProperties => cut(drawn) ? {} : { overflow: "visible" }

/**
 * The stage is paper cut to the drawing (`placeSheetAtom`). The paper keeps
 * the kept arrangement's height while the next search's trials run and while
 * another trial is drawn on it, so nothing around the stage moves for a jump,
 * and scrubbing the trace never moves the trace: a sketch or a trial that
 * runs longer than the sheet is clipped with a fade and scrolls, which is the
 * same fact the search holds against it. Once the trials are in, the edge
 * travels with the discs to the best, and the paper lands with them.
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
    {cut(drawn)
      ? (
        <>
          <Layer className={fadeClassName} data-place-stage-fade />
          <ScrollArea.Scrollbar className={scrollbarClassName} orientation="vertical">
            <ScrollArea.Thumb className="flex-1 rounded-full bg-ink-700/35" />
          </ScrollArea.Scrollbar>
        </>
      )
      : null}
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

/** Before the artifact is known nothing about the paper is: three lines stand in for it. */
const Placeholder = () => (
  <Stack className="gap-3 p-4">
    <ShimmerLine width="w-4/5" />
    <ShimmerLine width="w-3/5" />
    <ShimmerLine width="w-2/3" />
  </Stack>
)

/** A column of set prose, as a skeleton reads: full lines, a shorter last one. */
const sketchedLineWidth = (index: number, count: number): string =>
  index === count - 1
    ? "w-1/2"
    : Option.getOrElse(Arr.get(["w-11/12", "w-full", "w-5/6", "w-full"], index % 4), () => "w-full")

/**
 * The paper before the first frame: cut to the sheet the search is expected to
 * want (`placeSheetAtom`), which the first frame then holds, so the page around
 * the stage is at its size from the moment the artifact is known. The lines
 * the description will be set on are sketched where they will stand.
 */
const BlankPaper = ({ drawn, sheet }: { readonly drawn: PlaceDrawn; readonly sheet: PlaceSheet }) => {
  const stage = stageFor(sheet.width)
  const count = Math.floor((sheet.height - 2 * stage.padding) / stage.lineHeight)
  return (
    <Layer
      aria-busy
      className={paperClassName}
      data-place-drawn={drawn}
      data-place-stage="paper"
      data-place-stage-height={String(sheet.height)}
      style={{ height: `${sheet.height}px`, width: `${sheet.width}px` }}
    >
      <Stack style={{ padding: `${stage.padding}px` }}>
        {Arr.map(
          Arr.range(0, count - 1),
          (index) => (
            <Layer className="flex items-center" key={index} style={{ height: `${stage.lineHeight}px` }}>
              <ShimmerLine width={sketchedLineWidth(index, count)} />
            </Layer>
          )
        )}
      </Stack>
    </Layer>
  )
}

/** Discs are named or numbered as a set; the legend accompanies the numbers. */
const numbered = (frame: PlaceRenderFrame): boolean => Record.isEmptyRecord(frame.search.labels)

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
          {Option.match(sheet, {
            onNone: () => <Placeholder />,
            onSome: (cut) =>
              Option.match(latest, {
                onNone: () => <BlankPaper drawn={drawn} sheet={cut} />,
                onSome: (frame) => (
                  <Paper
                    drawn={drawn}
                    frame={frame}
                    sheet={cut}
                    shown={Option.match(preview, { onNone: () => "kept", onSome: String })}
                  />
                )
              })
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
