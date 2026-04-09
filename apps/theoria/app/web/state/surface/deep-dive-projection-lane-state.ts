import { Schema } from "effect"

import { DeepDiveProjectionPlane } from "./deep-dive.js"

export class DeepDiveProjectionSurfaceState extends Schema.Class<DeepDiveProjectionSurfaceState>(
  "DeepDiveProjectionSurfaceState"
)({
  focused: Schema.Boolean,
  id: DeepDiveProjectionPlane,
  position: Schema.NullOr(Schema.Number),
  projected: Schema.Boolean
}) {}

export class DeepDiveProjectionLaneState extends Schema.Class<DeepDiveProjectionLaneState>(
  "DeepDiveProjectionLaneState"
)({
  focusedSurface: DeepDiveProjectionPlane,
  maxProjectedCount: Schema.Number,
  projectedCount: Schema.Number,
  surfaceOrder: Schema.Array(DeepDiveProjectionPlane),
  surfaces: Schema.Array(DeepDiveProjectionSurfaceState),
  visibleProjectedCount: Schema.Number
}) {}

export class DeepDiveProjectionLaneChange extends Schema.Class<DeepDiveProjectionLaneChange>(
  "DeepDiveProjectionLaneChange"
)({
  focusedSurface: DeepDiveProjectionPlane,
  projectedCount: Schema.Number,
  surfaceOrder: Schema.Array(DeepDiveProjectionPlane)
}) {}
