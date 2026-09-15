import * as LinearAlgebra from "@scenesystems/effect-math/LinearAlgebra"
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Boolean as Bool, Number as Num, Option, Order, Schema, Tuple } from "effect"
import * as Arr from "effect/Array"
import * as Chunk from "effect/Chunk"

import { type ColorMode, neutralColor, type Oklch } from "./palette.js"

/**
 * The brand: the mark and the two colours everything outside the stylesheet
 * is painted in. `app/web/brand/brandAssets.ts` renders it to `favicon.svg`,
 * `manifest.webmanifest`, the `theme-color` metas in `index.html` and the
 * share cards' palette; `TheoriaLogo` draws the same mark in the page. A
 * contract test holds each artefact to its rendering, as the stylesheet is
 * held to the palette.
 *
 * The mark is one voxel seen from the canonical isometric angle — a rotation
 * of `atan(√2)` about x, then `π/4` about y — lit from the upper left. Its
 * geometry is computed here, once, from that description; no file carries
 * the polygons by hand.
 */

const Unit = Schema.Number.pipe(Schema.between(0, 1))

/** A point on the mark's plane, after projection. */
export const MarkPoint = Schema.Tuple(Schema.Number, Schema.Number)

export type MarkPoint = typeof MarkPoint.Type

/** One visible face of the cube: its outline, and how much light it takes. */
export class MarkFace extends Schema.Class<MarkFace>("MarkFace")({
  points: Schema.Array(MarkPoint),
  fillOpacity: Unit
}) {}

/** The mark's frame: the tight bounds of its faces with a hair of padding. */
export class MarkViewBox extends Schema.Class<MarkViewBox>("MarkViewBox")({
  x: Schema.Number,
  y: Schema.Number,
  width: Schema.Number,
  height: Schema.Number
}) {}

/** The mark as drawn: its faces back to front, in its frame. */
export class Mark extends Schema.Class<Mark>("Mark")({
  viewBox: MarkViewBox,
  faces: Schema.Array(MarkFace)
}) {}

/** A face's edge, drawn in the face's colour: a soft, thin rule. */
export const markStroke = { opacity: 0.3, width: 0.02 }

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

type Vector = Chunk.Chunk<number>

const vector = (x: number, y: number, z: number): Vector => Chunk.make(x, y, z)

const component = (v: Vector, index: number): number => Chunk.unsafeGet(v, index)

/** A face of the unit cube: its four corners, and the direction it faces. */
class CubeFace extends Schema.Class<CubeFace>("CubeFace")({
  vertices: Schema.Chunk(Schema.Chunk(Schema.Number)),
  normal: Schema.Chunk(Schema.Number)
}) {}

const cubeFace = (vertices: ReadonlyArray<Vector>, normal: Vector): CubeFace =>
  new CubeFace({ vertices: Chunk.fromIterable(vertices), normal })

const half = 0.5

const cubeFaces: ReadonlyArray<CubeFace> = [
  cubeFace(
    [vector(-half, -half, half), vector(half, -half, half), vector(half, half, half), vector(-half, half, half)],
    vector(0, 0, 1)
  ),
  cubeFace(
    [vector(half, -half, -half), vector(-half, -half, -half), vector(-half, half, -half), vector(half, half, -half)],
    vector(0, 0, -1)
  ),
  cubeFace(
    [vector(-half, half, -half), vector(-half, half, half), vector(half, half, half), vector(half, half, -half)],
    vector(0, 1, 0)
  ),
  cubeFace(
    [vector(-half, -half, -half), vector(half, -half, -half), vector(half, -half, half), vector(-half, -half, half)],
    vector(0, -1, 0)
  ),
  cubeFace(
    [vector(half, -half, -half), vector(half, -half, half), vector(half, half, half), vector(half, half, -half)],
    vector(1, 0, 0)
  ),
  cubeFace(
    [vector(-half, -half, half), vector(-half, -half, -half), vector(-half, half, -half), vector(-half, half, half)],
    vector(-1, 0, 0)
  )
]

/**
 * The isometric view: `cos(atan √2) = 1/√3` and `sin(atan √2) = √(2/3)` about
 * x, then `π/4` about y, whose sine and cosine are both `√½`.
 */
const cosX = Numeric.unsafeDivide(1, Numeric.sqrt(3))
const sinX = Numeric.sqrt(Numeric.unsafeDivide(2, 3))
const cosY = Numeric.sqrt(half)
const sinY = cosY

const aboutX = Chunk.make(1, 0, 0, 0, cosX, Num.negate(sinX), 0, sinX, cosX)
const aboutY = Chunk.make(cosY, 0, sinY, 0, 1, 0, Num.negate(sinY), 0, cosY)

const rotate = (v: Vector): Vector => LinearAlgebra.matvec(aboutY, 3, 3, LinearAlgebra.matvec(aboutX, 3, 3, v))

/** The vector at unit length; every vector normalised here is a constant of non-zero length. */
const normalise = (v: Vector): Vector => LinearAlgebra.vectorScale(Numeric.unsafeDivide(1, LinearAlgebra.normL2(v)), v)

const light = normalise(vector(0.3, -0.3, 0.9))

/** How much of the light a face turned `normal`-wards takes: between a quarter and full, never dark. */
const lightOn = (normal: Vector): number =>
  Num.max(0.25, Num.sum(Num.multiply(LinearAlgebra.dot(normalise(normal), light), half), 0.55))

class ProjectedFace extends Schema.Class<ProjectedFace>("ProjectedFace")({
  face: MarkFace,
  depth: Schema.Number
}) {}

/** A face turned towards the viewer, projected: its corners on the plane (y up becomes y down), its mean depth, and its light. */
const project = (face: CubeFace, normal: Vector): ProjectedFace => {
  const corners = Chunk.map(face.vertices, rotate)
  return new ProjectedFace({
    face: new MarkFace({
      points: Chunk.toReadonlyArray(
        Chunk.map(corners, (corner) => Tuple.make(component(corner, 0), Num.negate(component(corner, 1))))
      ),
      fillOpacity: Num.sum(0.6, Num.multiply(lightOn(normal), 0.3))
    }),
    depth: Numeric.unsafeDivide(
      Numeric.sum(Chunk.map(corners, (corner) => component(corner, 2))),
      Chunk.size(corners)
    )
  })
}

const byDepth = Order.mapInput(Num.Order, (projected: ProjectedFace) => projected.depth)

/** The faces the viewer sees, back to front. */
const visibleFaces: ReadonlyArray<MarkFace> = Arr.map(
  Arr.sort(
    Arr.filterMap(cubeFaces, (face) => {
      const normal = rotate(face.normal)
      return Bool.match(Num.greaterThan(component(normal, 2), 0), {
        onTrue: () => Option.some(project(face, normal)),
        onFalse: Option.none
      })
    }),
    byDepth
  ),
  (projected) => projected.face
)

const padding = 0.06

/** The least and greatest of some values, or the origin when there are none. */
const extent = (values: ReadonlyArray<number>): readonly [number, number] =>
  Arr.match(values, {
    onEmpty: () => Tuple.make(0, 0),
    onNonEmpty: (some) => Tuple.make(Arr.min(some, Num.Order), Arr.max(some, Num.Order))
  })

const frame = (faces: ReadonlyArray<MarkFace>): MarkViewBox => {
  const points = Arr.flatMap(faces, (face) => face.points)
  const [left, right] = extent(Arr.map(points, Tuple.getFirst))
  const [top, bottom] = extent(Arr.map(points, Tuple.getSecond))
  return new MarkViewBox({
    x: Num.subtract(left, padding),
    y: Num.subtract(top, padding),
    width: Num.sum(Num.subtract(right, left), Num.multiply(padding, 2)),
    height: Num.sum(Num.subtract(bottom, top), Num.multiply(padding, 2))
  })
}

/** The mark. */
export const mark: Mark = new Mark({ viewBox: frame(visibleFaces), faces: visibleFaces })

// ---------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------

/**
 * What the brand is painted in outside the page: the canvas the browser's
 * chrome and the installed app's splash take, and the ink the mark is drawn
 * in. Each is the palette's role of that name, so the chrome matches the page.
 */
export const BrandRole = Schema.Literal("canvas", "ink")

export type BrandRole = typeof BrandRole.Type

export const brandColor = (role: BrandRole, mode: ColorMode): Oklch => neutralColor(role, mode)
