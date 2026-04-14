import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import {
  buildPackageDocsSearchIndex,
  loadPackageDocsCorpus,
  packageNameFromString,
  resolveRootFrom,
  searchPackageDocsIndex
} from "../src/index.js"

const repositoryRootUrl = new URL("../../../", import.meta.url)

describe("package docs search", () => {
  it.effect("matches semantic token variants and prefixes instead of only exact token hits", () =>
    Effect.gen(function*() {
      const repositoryRoot = yield* resolveRootFrom(repositoryRootUrl)
      const corpus = yield* loadPackageDocsCorpus({ repositoryRoot })
      const index = buildPackageDocsSearchIndex(corpus)
      const effectSearch = packageNameFromString("effect-search")
      const snapResults = searchPackageDocsIndex(index, {
        query: "snap",
        packageId: effectSearch,
        limit: 10
      })
      const studyEventResults = searchPackageDocsIndex(index, {
        query: "study event",
        packageId: effectSearch,
        limit: 10
      })
      const exampleResults = searchPackageDocsIndex(index, {
        query: "example",
        packageId: effectSearch,
        limit: 10
      })
      const resumeSeedResults = searchPackageDocsIndex(index, {
        query: "resume seed",
        packageId: effectSearch,
        limit: 10
      })
      const snapshotTypoResults = searchPackageDocsIndex(index, {
        query: "snapshpt",
        packageId: effectSearch,
        limit: 10
      })
      const verifyTypoResults = searchPackageDocsIndex(index, {
        query: "verfy",
        packageId: effectSearch,
        limit: 10
      })

      expect(snapResults.some((result) => result.title === "snapshot")).toBe(true)
      expect(studyEventResults.some((result) => result.title === "StudyEvent")).toBe(true)
      expect(exampleResults[0]?.source.kind).toBe("example")
      expect(resumeSeedResults.some((result) => result.title === "resumeSeed overview")).toBe(true)
      expect(snapshotTypoResults.some((result) => result.title === "snapshot")).toBe(true)
      expect(verifyTypoResults[0]?.source.kind).toBe("proof-command")
    }).pipe(Effect.provide(BunContext.layer)))
})
