import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"

import {
  loadPackageDocsCorpus,
  packageDocsAuthority,
  PackageDocsCorpusSchema,
  PackageDocsQuerySchema,
  resolveRootFrom,
  searchPackageDocs,
  TheoriaPackageDocsAuthority
} from "../../packages/source-proof/src/index.js"

const repositoryRootUrl = new URL("../../", import.meta.url)

describe("package docs repository contract", () => {
  it.effect("declares one canonical root-owned package-doc authority with corpus, query, and CLI seams", () =>
    Effect.sync(() => {
      expect(packageDocsAuthority).toBe(TheoriaPackageDocsAuthority)
      expect(TheoriaPackageDocsAuthority.name).toBe("root-package-docs-authority")
      expect(TheoriaPackageDocsAuthority.querySurfaces).toEqual(["catalog", "bundle", "bounded-search"])
      expect(TheoriaPackageDocsAuthority.cliEntrypoints).toEqual(["scripts/docs-packages.ts"])
    }))

  it.effect("loads the canonical corpus and returns source-linked bounded search results", () =>
    Effect.gen(function*() {
      const repositoryRoot = yield* resolveRootFrom(repositoryRootUrl)
      const corpus = yield* loadPackageDocsCorpus({ repositoryRoot })
      const decodedCorpus = yield* Schema.decodeUnknown(PackageDocsCorpusSchema)(corpus).pipe(Effect.orDie)
      const query = yield* Schema.decodeUnknown(PackageDocsQuerySchema)({
        query: "study snapshot",
        packageId: "effect-search",
        limit: 5
      }).pipe(Effect.orDie)
      const results = searchPackageDocs(decodedCorpus, query)

      expect(decodedCorpus.catalog.length).toBe(8)
      expect(results.length).toBeGreaterThan(0)
      expect(results.every((result) => result.packageId === "effect-search")).toBe(true)
      expect(results.every((result) => result.source.path.startsWith("packages/effect-search/"))).toBe(true)
    }).pipe(Effect.provide(BunContext.layer)))
})
