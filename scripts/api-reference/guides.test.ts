import { describe, expect, it } from "@effect/vitest"
import { Option } from "effect"
import type { Paragraph } from "mdast"

import type { GuideBlock } from "@theoria/docs-model"
import { guideBlock } from "./guide-markdown.js"
import { enrichGuideBlocks } from "./guides.js"

const paragraph: GuideBlock = {
  kind: "paragraph",
  parts: [{ kind: "text", text: "Runnable package examples." }]
}

describe("documentation guide generation", () => {
  it("embeds a package-owned example in an examples guide without code", () => {
    const blocks = enrichGuideBlocks(
      "Examples and reference",
      [paragraph],
      Option.some({ title: "Quick start", source: "const program = Effect.succeed(1)" })
    )

    expect(blocks).toEqual([
      { kind: "heading", depth: 3, id: "quick-start", text: "Quick start" },
      { kind: "code", language: "ts", source: "const program = Effect.succeed(1)" },
      paragraph
    ])
  })

  it("does not duplicate code already maintained in the package guide", () => {
    const code: GuideBlock = { kind: "code", language: "ts", source: "Effect.succeed(1)" }
    const blocks = enrichGuideBlocks(
      "Examples",
      [paragraph, code],
      Option.some({ title: "Quick start", source: "Effect.succeed(2)" })
    )

    expect(blocks).toEqual([paragraph, code])
  })

  it("routes public source indexes to the in-site API reference", () => {
    const node: Paragraph = {
      type: "paragraph",
      children: [{
        type: "link",
        url: "./src/contracts/index.ts",
        children: [{ type: "text", value: "contracts" }]
      }]
    }
    const block = Option.getOrThrow(guideBlock({ node, packageSlug: "effect-math", revision: "revision" }))

    expect(block).toEqual({
      kind: "paragraph",
      parts: [{ kind: "link", text: "contracts", href: "/docs/effect-math/api/contracts" }]
    })
  })
})
