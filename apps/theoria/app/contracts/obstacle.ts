import { Schema } from "effect"

import { CardTone } from "./tone.js"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))
const PositiveInt = Schema.Number.pipe(Schema.int(), Schema.greaterThan(0))
const NonNegativeInt = Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))

export const ObstacleId = NonEmptyString

export type ObstacleId = typeof ObstacleId.Type

export const ObstaclePlacement = Schema.Literal("right", "left")

export type ObstaclePlacement = typeof ObstaclePlacement.Type

export const ObstacleVariant = Schema.Literal("quote", "panel", "figure", "stack", "code")

export type ObstacleVariant = typeof ObstacleVariant.Type

export const Obstacle = Schema.Struct({
  badge: NonEmptyString,
  detail: NonEmptyString,
  id: ObstacleId,
  label: NonEmptyString,
  heightPx: PositiveInt,
  tone: CardTone,
  topPx: NonNegativeInt,
  placement: ObstaclePlacement,
  variant: ObstacleVariant,
  widthPx: PositiveInt
})

export type Obstacle = typeof Obstacle.Type

export const ReflowScene = Schema.Struct({
  obstacles: Schema.NonEmptyArray(Obstacle),
  summary: NonEmptyString
})

export type ReflowScene = typeof ReflowScene.Type
