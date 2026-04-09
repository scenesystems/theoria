import { Schema } from "effect"

export class SurfaceTabHint extends Schema.Class<SurfaceTabHint>("SurfaceTabHint")({
  interactive: Schema.String,
  evidence: Schema.String
}) {}

export class ProjectionPlaneHint extends Schema.Class<ProjectionPlaneHint>("ProjectionPlaneHint")({
  stage: Schema.String,
  evidence: Schema.String,
  source: Schema.String
}) {}

export const defaultSurfaceTabHint: SurfaceTabHint = SurfaceTabHint.make({
  interactive: "Adjust parameters and see the results change in real time.",
  evidence: "Quantitative evidence from the benchmark — every number is reproducible."
})

export const defaultProjectionPlaneHint: ProjectionPlaneHint = ProjectionPlaneHint.make({
  stage: defaultSurfaceTabHint.interactive,
  evidence: defaultSurfaceTabHint.evidence,
  source: "Inspect the prepared and runtime program projections exactly as executed, file by file."
})

export const surfaceTabHintFromProjectionPlaneHint = (
  projectionPlaneHint: ProjectionPlaneHint
): SurfaceTabHint =>
  SurfaceTabHint.make({
    interactive: projectionPlaneHint.stage,
    evidence: projectionPlaneHint.evidence
  })
