import { describe, expect, it } from "@effect/vitest"
import { Effect, Record, Schema } from "effect"

import {
  WorkflowComparisonCatalogSchema,
  WorkflowProfileLibrarySchema
} from "../../app/contracts/workflow/comparison.js"
import {
  defaultWorkflowComparisonId,
  workflowComparisonById,
  workflowComparisons
} from "../fixtures/workflow/comparisons.js"
import { workflowProfileLibrary } from "../fixtures/workflow/profile-library.js"

describe("Theoria Workflow Comparison Contracts", () => {
  it.effect("decodes the released task, chat, retrieval, and render-sensitive workflow profile library", () =>
    Effect.gen(function*() {
      const decoded = yield* Schema.decodeUnknown(WorkflowProfileLibrarySchema)(workflowProfileLibrary)

      expect(Record.keys(decoded)).toEqual([
        "taskOriented",
        "chatOriented",
        "retrievalOriented",
        "renderSensitive"
      ])
    }))

  it.effect("decodes task-first and chat-continuation baseline-versus-optimized workflow comparisons", () =>
    Effect.gen(function*() {
      const decoded = yield* Schema.decodeUnknown(WorkflowComparisonCatalogSchema)(workflowComparisons)

      expect(decoded.map((comparison) => comparison.workflowKind)).toEqual(["task-first", "chat-continuation"])
      expect(
        decoded.every((comparison) =>
          comparison.reports.optimized.aggregateScore > comparison.reports.baseline.aggregateScore
        )
      ).toBe(true)
      expect(decoded.every((comparison) => comparison.records.baseline.graph.variant === "baseline")).toBe(true)
      expect(decoded.every((comparison) => comparison.records.optimized.graph.variant === "optimized")).toBe(true)
    }))

  it.effect("resolves the default workflow comparison through the catalog selector", () =>
    Effect.sync(() => {
      const comparison = workflowComparisonById(defaultWorkflowComparisonId)

      expect(comparison.id).toBe("task-briefing")
      expect(comparison.records.optimized.graph.nodes.length).toBeGreaterThan(
        comparison.records.baseline.graph.nodes.length
      )
    }))
})
