import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Option, Schema } from "effect"

import {
  loadPackageDocsCorpus,
  packageDocsBundle,
  PackageDocsBundleSchema,
  PackageDocsCorpusSchema,
  resolveRootFrom
} from "../src/index.js"

const repositoryRootUrl = new URL("../../../", import.meta.url)

const expectedPackageIds = [
  "@scenesystems/digest",
  "@scenesystems/seal",
  "@scenesystems/sign",
  "effect-dsp",
  "effect-inference",
  "effect-math",
  "effect-search",
  "effect-text"
]

describe("package docs contracts", () => {
  it.effect("resolves one normalized docs bundle for every shipped package in scope", () =>
    Effect.gen(function*() {
      const repositoryRoot = yield* resolveRootFrom(repositoryRootUrl)
      const corpus = yield* loadPackageDocsCorpus({ repositoryRoot })
      const decodedCorpus = yield* Schema.decodeUnknown(PackageDocsCorpusSchema)(corpus).pipe(Effect.orDie)

      expect(decodedCorpus.catalog.map((entry) => entry.packageId)).toEqual(expectedPackageIds)

      yield* Effect.forEach(expectedPackageIds, (packageId) =>
        Effect.gen(function*() {
          const bundle = packageDocsBundle(decodedCorpus, packageId)

          expect(Option.isSome(bundle)).toBe(true)

          if (Option.isNone(bundle)) {
            return
          }

          const decodedBundle = yield* Schema.decodeUnknown(PackageDocsBundleSchema)(bundle.value).pipe(Effect.orDie)

          expect(decodedBundle.readme.blocks.length).toBeGreaterThan(0)
          expect(decodedBundle.moduleDocs.length).toBeGreaterThan(0)
          expect(decodedBundle.examples.length).toBeGreaterThan(0)
          expect(decodedBundle.releaseSnapshots.length).toBeGreaterThan(0)
          expect(decodedBundle.proofCommands.length).toBeGreaterThan(0)
        }), { discard: true })
    }).pipe(Effect.provide(BunContext.layer)))
})
