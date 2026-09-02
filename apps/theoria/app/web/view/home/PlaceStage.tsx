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

import { markerLabel, markerTone } from "./placeViewModel.js"

const stageFrameBorderPx = 1

/** Below this diameter a marker shows its number; the legend carries the name. */
const namedMarkerMinDiameter = 56

/** Position with `translate`, which the compositor animates without re-laying out the text. */
const markerStyle = (marker: PlaceMarker): CSSProperties => ({
  translate: `${(marker.x - marker.radius).toFixed(1)}px ${(marker.y - marker.radius).toFixed(1)}px`,
  width: `${(marker.radius * 2).toFixed(1)}px`,
  height: `${(marker.radius * 2).toFixed(1)}px`
})

/**
 * Every trial the search accepts moves a marker a little; a merged proposal's
 * marker grows in from nothing. Both stop under `prefers-reduced-motion`.
 */
const markerMotionClassName =
  "transition-[translate,width,height,opacity,scale] duration-200 ease-out starting:scale-90 starting:opacity-0 motion-reduce:transition-none"

const lineStyle = (line: PlaceLine, padding: number, lineHeight: number): CSSProperties => ({
  left: `${padding}px`,
  top: `${line.y}px`,
  width: `${line.maxWidth.toFixed(1)}px`,
  height: `${lineHeight}px`
})

const Marker = ({ index, marker }: { readonly index: number; readonly marker: PlaceMarker }) => {
  const tone = markerTone(marker)
  const named = marker.radius * 2 >= namedMarkerMinDiameter
  return (
    <Layer
      aria-label={markerLabel(marker)}
      className={`absolute left-0 top-0 flex items-center justify-center overflow-hidden rounded-full border px-1 text-center ${markerMotionClassName} ${tone.borderSubtle} ${tone.bgSubtle}`}
      role="img"
      style={markerStyle(marker)}
    >
      {named
        ? (
          <SemanticText
            as="p"
            className={`w-full ${tone.textStrong}`}
            role="marker-label"
            text={marker.name}
            variant="compact"
          />
        )
        : <SemanticText as="span" className={tone.textStrong} role="tab-label" text={String(index + 1)} />}
    </Layer>
  )
}

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

const Drawing = ({ frame }: { readonly frame: PlaceRenderFrame }) => {
  const projection = frame.rendering.projection
  return (
    <Layer
      aria-busy={frame.phase === "running"}
      className="relative transition-[height,width] duration-200 ease-out motion-reduce:transition-none"
      data-place-stage="content"
      data-place-stage-width={String(projection.stageWidth)}
      style={{ height: `${projection.stageHeight}px`, width: `${projection.stageWidth}px` }}
    >
      {Arr.map(projection.markers, (marker, index) => <Marker index={index} key={marker.name} marker={marker} />)}
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
