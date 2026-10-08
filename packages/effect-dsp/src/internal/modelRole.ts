/** Scoped optimizer role inherited by nested predictors. */
import type { Role } from "@scenesystems/effect-lm/Role"
import { Context } from "effect"

/** @internal */
export const CurrentRole = Context.Reference<Role>("@scenesystems/effect-dsp/internal/modelRole", {
  defaultValue: () => "task"
})
