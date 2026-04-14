import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import {
  loadPackageDocsCorpus,
  PackageDocsRichTextDocument,
  PackageDocsRichTextTextNode,
  type PackageDocsSearchResult,
  type PackageDocsSectionBlock,
  type PackageName
} from "@theoria/source-proof"
import { Effect } from "effect"

import {
  PackageDocsPackagePageRoute,
  PackageDocsPageModel,
  PackageDocsSearchItem
} from "../../app/contracts/presentation/package-docs.js"

const textDocument = (text: string): PackageDocsRichTextDocument =>
  PackageDocsRichTextDocument.make({
    children: text.length === 0 ? [] : [PackageDocsRichTextTextNode.make({ value: text })]
  })

const searchResultFromBlock = (input: {
  readonly block: PackageDocsSectionBlock
  readonly packageId: PackageName
}): PackageDocsSearchResult => ({
  excerptDocument: textDocument(input.block.content),
  packageId: input.packageId,
  title: input.block.title,
  titleDocument: input.block.titleDocument,
  excerpt: input.block.content,
  source: input.block.source,
  score: 1
})

describe("web/package-doc-section-fragment-alignment", () => {
  it.live("keeps exact result hrefs aligned with rendered section fragments across package-doc source kinds", () =>
    Effect.gen(function*() {
      const corpus = yield* loadPackageDocsCorpus()
      const bundle = corpus.bundles.find((candidate) =>
        candidate.readme.blocks.length > 0
        && candidate.moduleDocs.some((document) => document.blocks.length > 0)
        && candidate.examples.length > 0
        && candidate.releaseSnapshots.length > 0
        && candidate.proofCommands.length > 0
      ) ?? null

      expect(bundle).toBeDefined()

      if (bundle === null) {
        return
      }

      const pageModel = PackageDocsPageModel.project({
        bundle,
        catalog: corpus.catalog,
        selectedPackageId: bundle.packageId
      })
      const routePath = PackageDocsPackagePageRoute.fromPackageId(bundle.packageId).path()
      const readmeBlock = bundle.readme.blocks[0] ?? null
      const referenceBlock = bundle.moduleDocs[0]?.blocks[0] ?? null
      const exampleBlock = bundle.examples[0]?.block ?? null
      const releaseBlock = bundle.releaseSnapshots[0]?.block ?? null
      const latestReleaseBlock = bundle.releaseSnapshots[bundle.releaseSnapshots.length - 1]?.block ?? null
      const verificationBlock = bundle.proofCommands[0]?.block ?? null
      const readmeFragment = pageModel.groups.find((group) => group.title === "README")?.sections[0]?.fragmentId
      const referenceFragment = pageModel.groups.find((group) => group.title === "Reference")?.sections[0]?.fragmentId
      const exampleFragment = pageModel.groups.find((group) => group.title === "Examples")?.sections[0]?.fragmentId
      const releaseFragment = pageModel.groups.find((group) => group.title === "Release History")?.sections[0]
        ?.fragmentId
      const verificationFragment = pageModel.groups.find((group) => group.title === "Verification")?.sections[0]
        ?.fragmentId

      expect(readmeBlock).toBeDefined()
      expect(referenceBlock).toBeDefined()
      expect(exampleBlock).toBeDefined()
      expect(releaseBlock).toBeDefined()
      expect(latestReleaseBlock).toBeDefined()
      expect(verificationBlock).toBeDefined()
      expect(readmeFragment).toBeDefined()
      expect(referenceFragment).toBeDefined()
      expect(exampleFragment).toBeDefined()
      expect(releaseFragment).toBeDefined()
      expect(verificationFragment).toBeDefined()

      if (
        readmeBlock === null
        || referenceBlock === null
        || exampleBlock === null
        || releaseBlock === null
        || latestReleaseBlock === null
        || verificationBlock === null
      ) {
        return
      }

      const readmeItem = PackageDocsSearchItem.fromResult(searchResultFromBlock({
        block: readmeBlock,
        packageId: bundle.packageId
      }))
      const referenceItem = PackageDocsSearchItem.fromResult(searchResultFromBlock({
        block: referenceBlock,
        packageId: bundle.packageId
      }))
      const exampleItem = PackageDocsSearchItem.fromResult(searchResultFromBlock({
        block: exampleBlock,
        packageId: bundle.packageId
      }))
      const releaseItem = PackageDocsSearchItem.fromResult(searchResultFromBlock({
        block: releaseBlock,
        packageId: bundle.packageId
      }))
      const latestReleaseItem = PackageDocsSearchItem.fromResult(searchResultFromBlock({
        block: latestReleaseBlock,
        packageId: bundle.packageId
      }))
      const verificationItem = PackageDocsSearchItem.fromResult(searchResultFromBlock({
        block: verificationBlock,
        packageId: bundle.packageId
      }))

      expect(readmeItem.fragmentId).toBe(readmeFragment)
      expect(referenceItem.fragmentId).toBe(referenceFragment)
      expect(exampleItem.fragmentId).toBe(exampleFragment)
      expect(latestReleaseItem.fragmentId).toBe(releaseFragment)
      expect(verificationItem.fragmentId).toBe(verificationFragment)

      expect(readmeItem.href).toBe(`${routePath}#${readmeFragment}`)
      expect(referenceItem.href).toBe(`${routePath}#${referenceFragment}`)
      expect(exampleItem.href).toBe(`${routePath}#${exampleFragment}`)
      expect(latestReleaseItem.href).toBe(`${routePath}#${releaseFragment}`)
      expect(verificationItem.href).toBe(`${routePath}#${verificationFragment}`)
      expect(releaseItem.fragmentId).not.toBe(releaseFragment)
    }).pipe(Effect.provide(BunContext.layer)))
})
