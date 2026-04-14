import { Chunk } from "effect"
import { LinearAlgebra } from "effect-math"

import { Box, mergeClassNames } from "../structure/Box.js"
import { Cluster } from "../structure/Cluster.js"
import { SemanticText } from "../structure/SemanticText.js"
import { WordmarkMorph } from "./WordmarkMorph.js"

type Vector3 = readonly [number, number, number]
type Point2 = readonly [number, number]

const toChunk = (value: Vector3): Chunk.Chunk<number> => Chunk.fromIterable(value)

const canonicalRotation = {
  cosX: Math.cos(Math.atan(Math.sqrt(2))),
  sinX: Math.sin(Math.atan(Math.sqrt(2))),
  cosY: Math.cos(Math.PI / 4),
  sinY: Math.sin(Math.PI / 4)
}

const faceDefinitions: ReadonlyArray<{
  readonly normal: Vector3
  readonly vertices: ReadonlyArray<Vector3>
}> = [
  { vertices: [[-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]], normal: [0, 0, 1] },
  { vertices: [[0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5]], normal: [0, 0, -1] },
  { vertices: [[-0.5, 0.5, -0.5], [-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5]], normal: [0, 1, 0] },
  { vertices: [[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5]], normal: [0, -1, 0] },
  { vertices: [[0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5]], normal: [1, 0, 0] },
  { vertices: [[-0.5, -0.5, 0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [-0.5, 0.5, 0.5]], normal: [-1, 0, 0] }
]

const lightDirection: Vector3 = [0.3, -0.3, 0.9]

const rotatePoint = (point: Vector3): Vector3 => {
  const { cosX, sinX, cosY, sinY } = canonicalRotation
  const xRotation = Chunk.fromIterable([1, 0, 0, 0, cosX, -sinX, 0, sinX, cosX])
  const yRotation = Chunk.fromIterable([cosY, 0, sinY, 0, 1, 0, -sinY, 0, cosY])
  const rotatedX = LinearAlgebra.matvec(xRotation, 3, 3, toChunk(point))
  const rotatedY = LinearAlgebra.matvec(yRotation, 3, 3, rotatedX)
  const [x = 0, y = 0, z = 0] = Chunk.toReadonlyArray(rotatedY)

  return [x, y, z]
}

const normalizeVector = (value: Vector3): Vector3 => {
  const length = LinearAlgebra.normL2(toChunk(value))

  if (length === 0) {
    return [0, 0, 0]
  }

  const [x = 0, y = 0, z = 0] = Chunk.toReadonlyArray(LinearAlgebra.vectorScale(1 / length, toChunk(value)))

  return [x, y, z]
}

const normalizedLightDirection = normalizeVector(lightDirection)

const visibleFaces = faceDefinitions.flatMap((definition) => {
  const rotatedNormal = rotatePoint(definition.normal)

  if (rotatedNormal[2] <= 0) {
    return []
  }

  const normalizedNormal = normalizeVector(rotatedNormal)
  const intensity = Math.max(
    0.25,
    LinearAlgebra.dot(toChunk(normalizedNormal), toChunk(normalizedLightDirection)) * 0.5 + 0.55
  )
  const rotatedVertices = definition.vertices.map(rotatePoint)
  const depth = rotatedVertices.reduce((sum, vertex) => sum + vertex[2], 0) / rotatedVertices.length
  const points: ReadonlyArray<Point2> = rotatedVertices.map((vertex) => [vertex[0], -vertex[1]])

  return [{ depth, opacity: 0.6 + intensity * 0.3, points }]
}).sort((left, right) => left.depth - right.depth)

const allPoints = visibleFaces.flatMap((face) => face.points)
const boundsMinX = Math.min(...allPoints.map(([x]) => x))
const boundsMaxX = Math.max(...allPoints.map(([x]) => x))
const boundsMinY = Math.min(...allPoints.map(([, y]) => y))
const boundsMaxY = Math.max(...allPoints.map(([, y]) => y))
const boundsWidth = boundsMaxX - boundsMinX
const boundsHeight = boundsMaxY - boundsMinY
const padding = 0.06
const viewBox = `${(boundsMinX - padding).toFixed(4)} ${(boundsMinY - padding).toFixed(4)} ${
  (boundsWidth + padding * 2).toFixed(4)
} ${(boundsHeight + padding * 2).toFixed(4)}`

const toPointsAttribute = (points: ReadonlyArray<Point2>): string =>
  points.map(([x, y]) => `${x.toFixed(4)},${y.toFixed(4)}`).join(" ")

const CubeMark = ({ className }: { readonly className?: string }) => (
  <svg aria-hidden className={className} fill="none" preserveAspectRatio="xMidYMid meet" viewBox={viewBox}>
    {visibleFaces.map((face, index) => (
      <polygon
        key={index}
        fill="currentColor"
        fillOpacity={face.opacity}
        points={toPointsAttribute(face.points)}
        stroke="currentColor"
        strokeLinejoin="round"
        strokeOpacity={0.3}
        strokeWidth={0.02}
      />
    ))}
  </svg>
)

type TheoriaBrandProps = {
  readonly animation?: "glossary" | "none"
  readonly className?: string
}

export const TheoriaBrand = ({ animation = "none", className }: TheoriaBrandProps) => (
  <Cluster className={mergeClassNames("min-w-0 text-content-primary", className)} gap="sm">
    <CubeMark className="h-[0.85em] shrink-0" />
    <Box className="min-w-0">
      <SemanticText as="span" className="tracking-tight text-content-primary" role="display-sm" tone="inherit">
        {animation === "glossary" ? <WordmarkMorph /> : "Theoria"}
      </SemanticText>
    </Box>
  </Cluster>
)
