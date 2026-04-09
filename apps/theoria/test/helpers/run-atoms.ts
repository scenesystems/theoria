import { Match } from "effect"

import type { EntryId } from "../../app/contracts/entry/id.js"
import { startRun } from "../../app/web/atoms/run/execution.js"
import { pauseRun, resetRun, resumeRun, stopRun } from "../../app/web/atoms/run/lifecycle-actions.js"
import type { appRuntime } from "../../app/web/atoms/runtime.js"
import type { RunControlActionKind } from "../../app/web/state/run/types.js"

type TestRuntime = typeof appRuntime

type RunControlCommand = {
  readonly action: RunControlActionKind
  readonly id: EntryId
}

export const makeRunControlAtom = (runtime: TestRuntime) =>
  runtime.fn<RunControlCommand>()(
    ({ action, id }, ctx) =>
      Match.value(action).pipe(
        Match.when("run", () => startRun(id, ctx)),
        Match.when("pause", () => pauseRun(id, ctx)),
        Match.when("resume", () => resumeRun(id, ctx)),
        Match.when("stop", () => stopRun(id, ctx)),
        Match.orElse(() => resetRun(id, ctx))
      )
  )

export const makeRunDemoAtom = (runtime: TestRuntime) => runtime.fn<EntryId>()((id, ctx) => startRun(id, ctx))
