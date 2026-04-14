import { describe, expect, it } from "@effect/vitest"
import { PackageDocsRichTextDocument, PackageDocsRichTextTextNode, packageNameFromString } from "@theoria/source-proof"

import { PackageDocsSearchModel } from "../../app/contracts/presentation/package-docs.js"

const textDocument = (text: string): PackageDocsRichTextDocument =>
  PackageDocsRichTextDocument.make({
    children: text.length === 0 ? [] : [PackageDocsRichTextTextNode.make({ value: text })]
  })

const digestPackageName = packageNameFromString("@scenesystems/digest")

describe("package-docs search model", () => {
  it("derives presentation order from the visible lane order instead of raw score order", () => {
    const model = PackageDocsSearchModel.project({
      intent: "verification",
      packageId: null,
      query: "verify digest",
      recentSelections: [],
      results: [
        {
          excerpt: "Run the introductory example.",
          excerptDocument: textDocument("Run the introductory example."),
          packageId: digestPackageName,
          score: 99,
          source: {
            anchor: "quick-start",
            kind: "example",
            packageId: digestPackageName,
            path: "packages/digest/examples/01-quick-start.ts",
            title: "Quick start"
          },
          title: "Quick start",
          titleDocument: textDocument("Quick start")
        },
        {
          excerpt: "bun run --filter '@scenesystems/digest' verify:release",
          excerptDocument: textDocument("bun run --filter '@scenesystems/digest' verify:release"),
          packageId: digestPackageName,
          score: 10,
          source: {
            anchor: "scripts.verify-release",
            kind: "proof-command",
            packageId: digestPackageName,
            path: "packages/digest/package.json",
            title: "Script verify:release"
          },
          title: "Script verify:release",
          titleDocument: textDocument("Script verify:release")
        }
      ],
      suggestions: []
    })

    expect(model.results.map((item) => item.kind)).toEqual(["example", "verification"])
    expect(model.presentationItems.map((item) => item.kind)).toEqual(["verification", "example"])
    expect(model.lanes.map((lane) => lane.kind)).toEqual(["verification", "example"])
  })
})
