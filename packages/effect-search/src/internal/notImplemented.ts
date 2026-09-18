import { Effect } from "effect"
import { NotImplemented } from "../SearchError.js"

export const notImplemented = (feature: string): Effect.Effect<never, NotImplemented> =>
  Effect.fail(new NotImplemented({ feature }))
