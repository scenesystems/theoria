import { Effect } from "effect"
import { NotImplemented } from "../Errors/index.js"

export const notImplemented = (feature: string): Effect.Effect<never, NotImplemented> =>
  Effect.fail(new NotImplemented({ feature }))
