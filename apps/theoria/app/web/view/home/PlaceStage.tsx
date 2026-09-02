import { Result } from "@effect-atom/atom"
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Option } from "effect"
import * as Arr from "effect/Array"
import type { CSSProperties } from "react"

import type { PlaceLine, PlaceMarker, PlaceProjection } from "../../../contracts/imagined-place-result.js"
import { useElementWidthReporter } from "../../atoms/element-observation.js"
import { type PlaceRenderFrame, placeRenderFrameAtom } from "../../atoms/imagined-place-render.js"
import { placeStageContainerWidthAtom } from "../../atoms/imagined-place.js"
import { ArtifactStage } from "../primitives/ArtifactStage.js"
import { Cluster, Layer, Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { ShimmerLine } from "../primitives/Skeleton.js"

import { namedMarkerMinDiameter, PlaceMarkerDisc } from "./PlaceMarker.js"
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
 * The stage is paper: a faint radial wash in the stage tone, no invented
 * geography. The walk draws once when the search settles, the discs are
 * buttons, and the text sits above both.
 */
const Drawing = ({ frame }: { readonly frame: PlaceRenderFrame }) => {
  const projection = frame.rendering.projection
  return (
    <Layer
      aria-busy={frame.phase === "running"}
      className="relative bg-radial-[at_20%_0%] from-stage-50 to-stage-0 transition-[height,width] duration-200 ease-out motion-reduce:transition-none"
      data-place-stage="content"
      data-place-stage-width={String(projection.stageWidth)}
      style={{ height: `${projection.stageHeight}px`, width: `${projection.stageWidth}px` }}
    >
      {frame.phase === "complete"
        ? <PlaceWalk height={projection.stageHeight} markers={projection.markers} width={projection.stageWidth} />
        : null}
      {Arr.map(
        projection.markers,
        (marker, index) => <PlaceMarkerDisc index={index} key={marker.name} marker={marker} />
      )}
      <Lines projection={projection} />
    </Layer>
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

const anyNumbered = (markers: ReadonlyArray<PlaceMarker>): boolean =>
  Arr.some(markers, (marker) => marker.radius * 2 < namedMarkerMinDiameter)

/**
 * The place drawn at the stage width the visitor chose. The description flows
 * around the features; features from merged proposals keep their proposer's
 * accent. The drawing is presentation only: none of it is digested, so the
 * width changes what you see and nothing else.
 */
export const PlaceStage = () => {
  const frame = useAtomValue(placeRenderFrameAtom)
  const reportContainerWidth = useElementWidthReporter(useAtomSet(placeStageContainerWidthAtom))
  const latest = Result.value(frame)
  const frameWidth = Option.match(latest, {
    onNone: () => undefined,
    onSome: (value) => `${value.rendering.projection.stageWidth + stageFrameBorderPx * 2}px`
  })

  return (
    <Stack className="gap-3">
      <Layer>
        <ArtifactStage
          frameStyle={{ width: frameWidth }}
          viewportClassName="justify-center"
          viewportRef={reportContainerWidth}
        >
          {Option.match(latest, {
            onNone: () => <Placeholder />,
            onSome: (value) => <Drawing frame={value} />
          })}
        </ArtifactStage>
      </Layer>
      {Option.match(latest, {
        onNone: () => null,
        onSome: (value) =>
          anyNumbered(value.rendering.projection.markers)
            ? <Legend markers={value.rendering.projection.markers} />
            : null
      })}
    </Stack>
  )
}
