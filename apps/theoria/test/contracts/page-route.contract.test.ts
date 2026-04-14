import { describe, expect, it } from "@effect/vitest"
import { packageNameFromString } from "@theoria/source-proof"
import { Effect, Option } from "effect"

import { workflowEntryDescriptor } from "../../app/contracts/entry/descriptors/workflow.js"
import { EntryRegistry } from "../../app/contracts/entry/registry.js"
import { WorkflowHandoffDraft } from "../../app/contracts/presentation/interactions.js"
import { PageLocation } from "../../app/contracts/presentation/page-location.js"
import { PagePresentation } from "../../app/contracts/presentation/page.js"
import {
  EntryRoute,
  HomePageRoute,
  PackageDocsRoute,
  PageRoute,
  PageRouteKey,
  WorkflowStudyRoute
} from "../../app/contracts/presentation/path.js"
import { defaultWorkflowSeedId } from "../../app/contracts/study/workflow/catalog-policy.js"
import { WorkflowFixtureManifest } from "../../app/contracts/study/workflow/fixture-manifest.js"
import { WorkflowStudyInput } from "../../app/contracts/study/workflow/input.js"
import { workflowStudyPath } from "../../app/contracts/study/workflow/manifest.js"
import { loadOpenAgentTraceRegistry } from "../../app/server/study/workflow/open-agent-trace/registry.js"

const workflowHandoffDraftFixture = WorkflowHandoffDraft.make({
  annotationIds: ["annotation:trace:item:note"],
  objectiveIds: ["objective:trace:item"],
  selection: null,
  status: "ready",
  summary: "Carry the selected failure into workflow design.",
  transcriptEntryId: "trace:entry",
  title: "Trace-grounded workflow handoff"
})

describe("Theoria Page Route Contracts", () => {
  it("round-trips home, entry, and package-doc routes through their noun-owned route keys", () => {
    const routes = [
      HomePageRoute.home(),
      EntryRoute.fromEntryId("workflow"),
      WorkflowStudyRoute.fromSessionId(defaultWorkflowSeedId),
      PackageDocsRoute.fromSelectedPackageId(null),
      PackageDocsRoute.fromSelectedPackageId(packageNameFromString("effect-search"))
    ]

    expect(
      routes.map((route) => PageRouteKey.fromSerialized(route.key().serialize()).route())
    ).toEqual(routes)
  })

  it("projects every registered executable path through the single entry page family", () => {
    const entryRegistry = EntryRegistry.current()

    expect(
      entryRegistry.descriptors.map((descriptor) =>
        PagePresentation.project(EntryRoute.fromEntryId(descriptor.entryId))._tag
      )
    ).toEqual(entryRegistry.descriptors.map(() => "EntryPagePresentation"))
  })

  it("projects workflow study session routes through the workflow study page family", () => {
    expect(
      PagePresentation.project(WorkflowStudyRoute.fromSessionId(defaultWorkflowSeedId))._tag
    ).toBe("WorkflowStudyPagePresentation")
  })

  it("round-trips workflow handoff input through the canonical route search params", () => {
    const route = WorkflowStudyRoute.fromSessionId(
      defaultWorkflowSeedId,
      WorkflowStudyInput.withHandoff(workflowHandoffDraftFixture)
    )

    expect(WorkflowStudyRoute.fromLocation(PageLocation.fromUrl(route.path()))).toEqual(Option.some(route))
  })

  it.effect("accepts imported workflow session paths as visible HTML routes while publishing the canonical workflow route", () =>
    Effect.gen(function*() {
      const registry = yield* loadOpenAgentTraceRegistry
      const importedSessionId = Option.fromNullable(registry[0]).pipe(
        Option.map((entry) => entry.workflowProjection.workflowRecord.session.sessionId)
      )

      expect(Option.isSome(importedSessionId)).toBe(true)

      if (Option.isNone(importedSessionId)) {
        return
      }

      expect(Option.isNone(WorkflowFixtureManifest.optionForSeedId(importedSessionId.value))).toBe(true)
      expect(
        PageRoute.isHtmlLocation(PageLocation.fromPathnameSearch(workflowStudyPath(importedSessionId.value)), "preview")
      ).toBe(true)
      expect(PageRoute.visiblePathsForReleaseStage("preview")).toContain(workflowEntryDescriptor.path)
    }))
})
