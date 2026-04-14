import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { readProjectFile } from "@theoria/source-proof"
import { Effect } from "effect"

import { EntryDecodeError, EntryExecutionError, EntryRequestError } from "../../app/contracts/entry-error.js"
import { EvidenceStreamState } from "../../app/web/state/evidence/stream.js"
import { compactErrorMessage, statusFromError, statusFromPreload, statusText } from "../../app/web/state/run/status.js"
import type { RunState } from "../../app/web/state/run/types.js"
import { initialSurfaceState, type PreloadState } from "../../app/web/state/surface/state.js"
import { errorFixture, programPreviewFixture, runDataFixture } from "../helpers/entry-fixtures.js"
import {
  failedRunState,
  pausedRunState,
  runningRunState,
  stepQueueDrainedRunState,
  streamCompletedRunState,
  succeededRunState
} from "../helpers/run-state.js"

const appRootUrl = new URL("../../", import.meta.url)

describe("status runtime-boundary", () => {
  it.effect("keeps status copy free of app-local provider enums and provider-client wiring", () =>
    Effect.gen(function*() {
      const statusPath = "app/web/state/run/status.ts"
      const source = yield* readProjectFile(appRootUrl, statusPath)

      expect(source).not.toContain("\"openai\"")
      expect(source).not.toContain("\"anthropic\"")
      expect(source).not.toContain("\"openrouter\"")
      expect(source).not.toContain("@effect/ai-openai")
      expect(source).not.toContain("@effect/ai-anthropic")
      expect(source).not.toContain("@effect/ai-openrouter")
    }).pipe(Effect.provide(BunContext.layer)))
})

const statusStateFrom = (id: "workflow") => {
  const state = initialSurfaceState(id)
  return {
    preload: state.preload,
    run: state.run
  }
}

const surfaceStatusState = (state: { readonly preload: PreloadState; readonly run: RunState }) => ({
  preload: state.preload,
  run: state.run
})

const emptyEvidenceStream = EvidenceStreamState.empty()

describe("compactErrorMessage", () => {
  it.effect("returns first line only from multi-line message", () =>
    Effect.gen(function*() {
      expect(compactErrorMessage("first line\nsecond line\nthird")).toBe("first line")
    }))

  it.effect("normalizes whitespace", () =>
    Effect.gen(function*() {
      expect(compactErrorMessage("too   many\t\ttabs  and   spaces")).toBe(
        "too many tabs and spaces"
      )
    }))

  it.effect("truncates at 140 chars with trailing ellipsis", () =>
    Effect.gen(function*() {
      const long = "a".repeat(200)
      const result = compactErrorMessage(long)
      expect(result.length).toBe(140)
      expect(result).toBe("a".repeat(139) + "…")
    }))

  it.effect("does NOT truncate at exactly 140 chars", () =>
    Effect.gen(function*() {
      const exact = "b".repeat(140)
      expect(compactErrorMessage(exact)).toBe(exact)
    }))

  it.effect("returns empty string for empty input", () =>
    Effect.gen(function*() {
      expect(compactErrorMessage("")).toBe("")
    }))

  it.effect("handles message that is exactly 140 characters (no truncation)", () =>
    Effect.gen(function*() {
      const msg = "c".repeat(140)
      expect(compactErrorMessage(msg)).toBe(msg)
      expect(compactErrorMessage(msg).length).toBe(140)
    }))

  it.effect("handles message that is 141 characters (truncates to 139 + ellipsis)", () =>
    Effect.gen(function*() {
      const msg = "d".repeat(141)
      const result = compactErrorMessage(msg)
      expect(result.length).toBe(140)
      expect(result).toBe("d".repeat(139) + "…")
    }))
})

describe("statusFromError", () => {
  it.effect("execution-timeout returns timeout message", () =>
    Effect.gen(function*() {
      const error = new EntryExecutionError({
        code: "execution-timeout",
        message: "timed out",
        retryable: true
      })
      expect(statusFromError(error)).toBe("Run timed out. Retry to collect evidence.")
    }))

  it.effect("provider-unavailable returns compact error message", () =>
    Effect.gen(function*() {
      const error = new EntryExecutionError({
        code: "provider-unavailable",
        message: "Provider XYZ is down",
        retryable: true
      })
      expect(statusFromError(error)).toBe("Provider XYZ is down")
    }))

  it.effect("invalid-entry-id returns unavailable message", () =>
    Effect.gen(function*() {
      const error = new EntryExecutionError({
        code: "invalid-entry-id",
        message: "bad id",
        retryable: false
      })
      expect(statusFromError(error)).toBe("Entry is unavailable in this runtime build.")
    }))

  it.effect("route-not-found returns refresh message", () =>
    Effect.gen(function*() {
      const error = new EntryExecutionError({
        code: "route-not-found",
        message: "no route",
        retryable: false
      })
      expect(statusFromError(error)).toBe("Entry route is unavailable. Refresh and retry.")
    }))

  it.effect("execution-failed with 'Entry execution failed.' message returns diagnostics message", () =>
    Effect.gen(function*() {
      const error = new EntryExecutionError({
        code: "execution-failed",
        message: "Entry execution failed.",
        retryable: false
      })
      expect(statusFromError(error)).toBe("Entry execution failed. Inspect diagnostics for details.")
    }))

  it.effect("execution-failed with empty message returns diagnostics message", () =>
    Effect.gen(function*() {
      const error = new EntryExecutionError({
        code: "execution-failed",
        message: "",
        retryable: false
      })
      expect(statusFromError(error)).toBe("Entry execution failed. Inspect diagnostics for details.")
    }))

  it.effect("execution-failed with custom detail returns prefixed message", () =>
    Effect.gen(function*() {
      const error = new EntryExecutionError({
        code: "execution-failed",
        message: "Null pointer in module X",
        retryable: false
      })
      expect(statusFromError(error)).toBe("Execution failed: Null pointer in module X")
    }))

  it.effect("EntryRequestError returns compact error message", () =>
    Effect.gen(function*() {
      const error = new EntryRequestError({ message: "Network timeout" })
      expect(statusFromError(error)).toBe("Network timeout")
    }))

  it.effect("EntryDecodeError returns decode error prefix", () =>
    Effect.gen(function*() {
      const error = new EntryDecodeError({ message: "Missing field" })
      expect(statusFromError(error)).toBe("Decode error: Missing field")
    }))
})

describe("statusFromPreload", () => {
  it.effect("PreloadIdle returns run prompt", () =>
    Effect.gen(function*() {
      const state = initialSurfaceState("workflow")
      expect(statusFromPreload(state.preload)).toBe(
        "Run the study to generate evidence and inspect code provenance."
      )
    }))

  it.effect("PreloadLoading returns preloading message", () =>
    Effect.gen(function*() {
      const preload: PreloadState = { _tag: "PreloadLoading" }
      const state = { ...initialSurfaceState("workflow"), preload }
      expect(statusFromPreload(state.preload)).toBe("Preloading program preview…")
    }))

  it.effect("PreloadFailed delegates to statusFromError", () =>
    Effect.gen(function*() {
      const preload: PreloadState = { _tag: "PreloadFailed", error: errorFixture }
      const state = { ...initialSurfaceState("workflow"), preload }
      expect(statusFromPreload(state.preload)).toBe(statusFromError(errorFixture))
    }))

  it.effect("PreloadReady returns ready message", () =>
    Effect.gen(function*() {
      const preload: PreloadState = { _tag: "PreloadReady", data: programPreviewFixture }
      const state = { ...initialSurfaceState("workflow"), preload }
      expect(statusFromPreload(state.preload)).toBe(
        "Program preview ready. Run to generate live evidence."
      )
    }))
})

describe("statusText", () => {
  it.effect("RunIdle + PreloadIdle falls through to preload status", () =>
    Effect.gen(function*() {
      expect(statusText(statusStateFrom("workflow"), emptyEvidenceStream.status())).toBe(
        "Run the study to generate evidence and inspect code provenance."
      )
    }))

  it.effect("RunRunning returns running message", () =>
    Effect.gen(function*() {
      const run = runningRunState({ program: programPreviewFixture.program })
      const state = { ...initialSurfaceState("workflow"), run }
      expect(statusText(surfaceStatusState(state), emptyEvidenceStream.status())).toBe(
        "Running study now…"
      )
    }))

  it.effect("RunRunning reports incremental streaming progress after the first section arrives", () =>
    Effect.gen(function*() {
      const stream = EvidenceStreamState.make({
        sections: [{ title: "Performance", items: [{ _tag: "Text", label: "Step", value: "1" }] }],
        complete: false,
        summary: null,
        meta: null
      })
      const run = runningRunState({ program: programPreviewFixture.program })
      const state = { ...initialSurfaceState("workflow"), run }
      expect(statusText(surfaceStatusState(state), stream.status())).toBe(
        "Streaming results… 1 section loaded."
      )
    }))

  it.effect("RunPaused keeps stream-owned pause copy once stream completion is recorded", () =>
    Effect.gen(function*() {
      const stream = EvidenceStreamState.make({
        sections: [{ title: "Performance", items: [{ _tag: "Text", label: "Step", value: "1" }] }],
        complete: false,
        summary: null,
        meta: null
      })
      const run = streamCompletedRunState({
        run: pausedRunState({ program: programPreviewFixture.program }),
        summary: "Server done."
      })
      const state = { ...initialSurfaceState("workflow"), run }
      expect(statusText(surfaceStatusState(state), stream.status())).toBe(
        "Run paused. Resume to continue streaming evidence."
      )
    }))

  it.effect("RunRunning keeps user-facing copy on the stream ledger even when only stream completion remains", () =>
    Effect.gen(function*() {
      const stream = EvidenceStreamState.make({
        sections: [{ title: "Trial Positions", items: [{ _tag: "Text", label: "Rows", value: "2" }] }],
        complete: false,
        summary: null,
        meta: null
      })
      const run = stepQueueDrainedRunState({
        run: runningRunState({ program: programPreviewFixture.program })
      })
      const state = { ...initialSurfaceState("workflow"), run }

      expect(statusText(surfaceStatusState(state), stream.status())).toBe(
        "Streaming results… 1 section loaded."
      )
    }))

  it.effect("RunPaused keeps the same evidence-led pause copy once only stream completion is outstanding", () =>
    Effect.gen(function*() {
      const stream = EvidenceStreamState.make({
        sections: [{ title: "Trial Positions", items: [{ _tag: "Text", label: "Rows", value: "2" }] }],
        complete: false,
        summary: null,
        meta: null
      })
      const run = stepQueueDrainedRunState({
        run: pausedRunState({ program: programPreviewFixture.program })
      })
      const state = { ...initialSurfaceState("workflow"), run }

      expect(statusText(surfaceStatusState(state), stream.status())).toBe(
        "Run paused. Resume to continue streaming evidence."
      )
    }))

  it.effect("RunPaused stays on neutral pause copy once both completion facts are present", () =>
    Effect.gen(function*() {
      const stream = EvidenceStreamState.make({
        sections: [{ title: "Trial Positions", items: [{ _tag: "Text", label: "Rows", value: "2" }] }],
        complete: true,
        summary: "Server done.",
        meta: null
      })
      const run = stepQueueDrainedRunState({
        run: streamCompletedRunState({
          run: pausedRunState({ program: programPreviewFixture.program }),
          summary: "Server done."
        })
      })
      const state = { ...initialSurfaceState("workflow"), run }

      expect(statusText(surfaceStatusState(state), stream.status())).toBe(
        "Run paused. Resume to continue streaming evidence."
      )
    }))

  it.effect("RunSuccess returns the run data summary", () =>
    Effect.gen(function*() {
      const fixture = runDataFixture("All benchmarks passed with 2× speedup.")
      const run = succeededRunState({ data: fixture })
      const state = { ...initialSurfaceState("workflow"), run }
      expect(statusText(surfaceStatusState(state), emptyEvidenceStream.status())).toBe(
        "All benchmarks passed with 2× speedup."
      )
    }))

  it.effect("RunFailed delegates to statusFromError", () =>
    Effect.gen(function*() {
      const run = failedRunState({ error: errorFixture, program: programPreviewFixture.program })
      const state = { ...initialSurfaceState("workflow"), run }
      expect(statusText(surfaceStatusState(state), emptyEvidenceStream.status())).toBe(
        statusFromError(errorFixture)
      )
    }))

  it.effect("RunFailed preserves partial-results context in the status text", () =>
    Effect.gen(function*() {
      const stream = EvidenceStreamState.make({
        sections: [{ title: "Performance", items: [{ _tag: "Text", label: "Step", value: "1" }] }],
        complete: false,
        summary: null,
        meta: null
      })
      const run = failedRunState({ error: errorFixture, program: programPreviewFixture.program })
      const state = { ...initialSurfaceState("workflow"), run }
      expect(statusText(surfaceStatusState(state), stream.status())).toBe(
        `${statusFromError(errorFixture)} Partial results remain visible.`
      )
    }))
})
