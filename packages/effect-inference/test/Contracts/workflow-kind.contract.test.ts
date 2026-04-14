import { describe, expect, it } from "@effect/vitest"
import { Either, Schema } from "effect"
import * as Arr from "effect/Array"

import * as Contracts from "../../src/contracts/index.js"

describe("Contracts/workflow-kind", () => {
  it("keeps the released workflow-family vocabulary exact", () => {
    const releasedWorkflowKinds = Arr.every(
      ["task-first", "chat-continuation", "retrieval-required", "render-sensitive"],
      (workflowKind) =>
        Either.isRight(
          Schema.decodeUnknownEither(Contracts.WorkflowKindSchema)(workflowKind, {
            onExcessProperty: "error"
          })
        )
    )

    const legacyOrAppLocalKindsStayRejected = Arr.every(
      ["task", "chat", "retrieval", "render"],
      (workflowKind) =>
        Either.isLeft(
          Schema.decodeUnknownEither(Contracts.WorkflowKindSchema)(workflowKind, {
            onExcessProperty: "error"
          })
        )
    )

    expect(releasedWorkflowKinds).toBe(true)
    expect(legacyOrAppLocalKindsStayRejected).toBe(true)
  })
})
