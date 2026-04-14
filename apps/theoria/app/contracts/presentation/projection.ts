import { Match, Schema } from "effect"

export const ProjectionPlane = Schema.Literal("source", "evidence", "stage", "interaction", "diagnostics")
export type ProjectionPlane = typeof ProjectionPlane.Type

export const projectionPlanes: ReadonlyArray<ProjectionPlane> = [
  "source",
  "evidence",
  "stage",
  "interaction",
  "diagnostics"
]

export const maxProjectedCount = 2

const projectionPlaneDescriptor = (plane: ProjectionPlane): {
  readonly label: string
  readonly description: string
} =>
  Match.value(plane).pipe(
    Match.when("source", () => ({
      label: "Source",
      description: "Prepared and runtime source for the active study."
    })),
    Match.when("evidence", () => ({
      label: "Evidence",
      description: "Metrics, diagnostics, and reproducible outcomes."
    })),
    Match.when("stage", () => ({
      label: "Study",
      description: "Controls, runtime cues, and live projections."
    })),
    Match.when("interaction", () => ({
      label: "Interaction",
      description: "Ordered interaction turns, tool actions, and runtime follow-up."
    })),
    Match.when("diagnostics", () => ({
      label: "Diagnostics",
      description: "Execution notes, lifecycle details, and timing for the current study run."
    })),
    Match.exhaustive
  )

export class ProjectionSurface extends Schema.Class<ProjectionSurface>("ProjectionSurface")({
  id: ProjectionPlane,
  label: Schema.String,
  description: Schema.String,
  projected: Schema.Boolean,
  focused: Schema.Boolean,
  position: Schema.NullOr(Schema.Number)
}) {}

export class ProjectionModel extends Schema.Class<ProjectionModel>("ProjectionModel")({
  surfaces: Schema.Array(ProjectionSurface),
  focusedSurface: ProjectionPlane,
  maxProjectedCount: Schema.Number
}) {}

export const projectionSurfacesFromPlanes = ({
  projected,
  focused
}: {
  readonly projected: ReadonlyArray<ProjectionPlane>
  readonly focused: ProjectionPlane
}): ReadonlyArray<ProjectionSurface> =>
  projectionPlanes.map((plane) => {
    const descriptor = projectionPlaneDescriptor(plane)
    const projectedIndex = projected.indexOf(plane)

    return ProjectionSurface.make({
      id: plane,
      label: descriptor.label,
      description: descriptor.description,
      projected: projectedIndex >= 0,
      focused: plane === focused,
      position: projectedIndex >= 0 ? projectedIndex : null
    })
  })

export const projectedSurfaces = (surfaces: ReadonlyArray<ProjectionSurface>): ReadonlyArray<ProjectionSurface> =>
  surfaces
    .filter((s) => s.projected)
    .sort((a, b) => (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER))

export const hiddenSurfaces = (surfaces: ReadonlyArray<ProjectionSurface>): ReadonlyArray<ProjectionSurface> =>
  surfaces.filter((s) => !s.projected)
