import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"

import { decodeStudyManifest, encodeStudyManifest, WorkflowManifest } from "../../app/contracts/study/manifest.js"
import { WorkflowRunControls } from "../../app/contracts/study/workflow/controls.js"
import { taskBriefingWorkflowSessionId } from "../../app/contracts/study/workflow/fixture-manifest.js"
import { WorkflowStudyInput } from "../../app/contracts/study/workflow/input.js"

describe("StreamManifest Contract", () => {
  it.effect("round-trips the workflow manifest", () =>
    Effect.gen(function*() {
      const encoded = encodeStudyManifest(
        WorkflowManifest.make({
          input: WorkflowStudyInput.empty(),
          seedId: taskBriefingWorkflowSessionId,
          controls: WorkflowRunControls.defaults()
        })
      )
      const decoded = Option.getOrNull(decodeStudyManifest(encoded))

      expect(decoded?._tag).toBe("workflow")
      if (decoded !== null && decoded._tag === "workflow") {
        expect(decoded.input.handoff).toBeNull()
        expect(decoded.seedId).toBe(taskBriefingWorkflowSessionId)
        expect(decoded.controls.targetMode).toBe("search-winner")
      }
    }))
})
