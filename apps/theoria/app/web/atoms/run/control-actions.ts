import { Match } from "effect"

import type { EntryId } from "../../../contracts/entry/id.js"
import { type RunControlActionKind } from "../../state/run/types.js"
import { appRuntime } from "../runtime.js"

import { startRun } from "./execution.js"
import { pauseRun, resetRun, resumeRun, stopRun } from "./lifecycle-actions.js"

type RunControlCommand = { readonly action: RunControlActionKind; readonly id: EntryId }

export const controlRunAtom = appRuntime.fn<RunControlCommand>()(
  ({ action, id }, ctx) =>
    Match.value(action).pipe(
      Match.when("run", () => startRun(id, ctx)),
      Match.when("pause", () => pauseRun(id, ctx)),
      Match.when("resume", () => resumeRun(id, ctx)),
      Match.when("stop", () => stopRun(id, ctx)),
      Match.orElse(() => resetRun(id, ctx))
    )
)

export const runDemoAtom = appRuntime.fn<EntryId>()((id, ctx) => startRun(id, ctx))
