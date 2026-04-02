import { Chunk } from "effect"
import { LinearAlgebra } from "effect-math"

type Vector3 = readonly [number, number, number]
type Point2 = readonly [number, number]

const toChunk = (v: Vector3): Chunk.Chunk<number> => Chunk.fromIterable(v)

const CANONICAL_ROTATION = {
  cosX: Math.cos(Math.atan(Math.sqrt(2))),
  sinX: Math.sin(Math.atan(Math.sqrt(2))),
  cosY: Math.cos(Math.PI / 4),
  sinY: Math.sin(Math.PI / 4)
}

const FACE_DEFS: ReadonlyArray<{
  readonly vertices: ReadonlyArray<Vector3>
  readonly normal: Vector3
}> = [
  { vertices: [[-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]], normal: [0, 0, 1] },
  { vertices: [[0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5]], normal: [0, 0, -1] },
  { vertices: [[-0.5, 0.5, -0.5], [-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5]], normal: [0, 1, 0] },
  { vertices: [[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5]], normal: [0, -1, 0] },
  { vertices: [[0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5]], normal: [1, 0, 0] },
  { vertices: [[-0.5, -0.5, 0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [-0.5, 0.5, 0.5]], normal: [-1, 0, 0] }
]

const LIGHT_DIR: Vector3 = [0.3, -0.3, 0.9]

const rotatePoint = (point: Vector3): Vector3 => {
  const { cosX, sinX, cosY, sinY } = CANONICAL_ROTATION
  const mx = Chunk.fromIterable([1, 0, 0, 0, cosX, -sinX, 0, sinX, cosX])
  const my = Chunk.fromIterable([cosY, 0, sinY, 0, 1, 0, -sinY, 0, cosY])
  const r1 = LinearAlgebra.matvec(mx, 3, 3, toChunk(point))
  const r2 = LinearAlgebra.matvec(my, 3, 3, r1)
  const [x = 0, y = 0, z = 0] = Chunk.toReadonlyArray(r2)
  return [x, y, z]
}

const normalizeV3 = (v: Vector3): Vector3 => {
  const len = LinearAlgebra.normL2(toChunk(v))
  if (len === 0) return [0, 0, 0]
  const [a = 0, b = 0, c = 0] = Chunk.toReadonlyArray(LinearAlgebra.vectorScale(1 / len, toChunk(v)))
  return [a, b, c]
}

const normLight = normalizeV3(LIGHT_DIR)

const visibleFaces = FACE_DEFS.flatMap((def) => {
  const rn = rotatePoint(def.normal)
  if (rn[2] <= 0) return []
  const normRn = normalizeV3(rn)
  const intensity = Math.max(0.25, LinearAlgebra.dot(toChunk(normRn), toChunk(normLight)) * 0.5 + 0.55)
  const rv = def.vertices.map(rotatePoint)
  const depth = rv.reduce((s, v) => s + v[2], 0) / rv.length
  const points: ReadonlyArray<Point2> = rv.map((v) => [v[0], -v[1]])
  return [{ points, depth, opacity: 0.6 + intensity * 0.3 }]
}).sort((a, b) => a.depth - b.depth)

const allPoints = visibleFaces.flatMap((f) => f.points)
const boundsMinX = Math.min(...allPoints.map(([x]) => x))
const boundsMaxX = Math.max(...allPoints.map(([x]) => x))
const boundsMinY = Math.min(...allPoints.map(([, y]) => y))
const boundsMaxY = Math.max(...allPoints.map(([, y]) => y))
const boundsW = boundsMaxX - boundsMinX
const boundsH = boundsMaxY - boundsMinY
const PAD = 0.06
const vbX = boundsMinX - PAD
const vbY = boundsMinY - PAD
const vbW = boundsW + PAD * 2
const vbH = boundsH + PAD * 2

const VIEWBOX = `${vbX.toFixed(4)} ${vbY.toFixed(4)} ${vbW.toFixed(4)} ${vbH.toFixed(4)}`

const toPointsAttr = (pts: ReadonlyArray<Point2>): string =>
  pts.map(([x, y]) => `${x.toFixed(4)},${y.toFixed(4)}`).join(" ")

const CubeMark = ({ className }: { readonly className?: string }) => (
  <svg
    aria-hidden
    className={className}
    fill="none"
    preserveAspectRatio="xMidYMid meet"
    viewBox={VIEWBOX}
  >
    {visibleFaces.map((face, i) => (
      <polygon
        key={i}
        fill="currentColor"
        fillOpacity={face.opacity}
        points={toPointsAttr(face.points)}
        stroke="currentColor"
        strokeLinejoin="round"
        strokeOpacity={0.3}
        strokeWidth={0.02}
      />
    ))}
  </svg>
)

/**
 * Branded Theoria logo — isometric cube mark + wordmark.
 *
 * The cube is a single voxel projected via effect-math `LinearAlgebra.matvec`
 * at the canonical isometric angle (atan(√2), π/4). The viewBox is computed
 * from the tight bounding box of the projected faces so the cube is
 * perfectly centered with no wasted space.
 *
 * The cube height matches `1.1em` (cap-height proportion of the display font)
 * so it aligns visually with the wordmark baseline.
 *
 * @since 0.1.0
 */
export const TheoriaLogo = ({
  className
}: {
  readonly className?: string
}) => {
  const base = "inline-flex items-center gap-[0.25em] font-display font-semibold tracking-tight select-none"
  const combined = className === undefined ? base : `${base} ${className}`

  return (
    <span className={combined}>
      <CubeMark className="h-[0.85em] shrink-0" />
      <span className="text-ink-900">Theoria</span>
    </span>
  )
}
