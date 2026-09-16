import { describe, expect, it } from "@effect/vitest"
import { Array, Effect, Option, Record, Schema, String } from "effect"

import { type GuideBlock, GuideBlockSchema } from "@theoria/docs-model"
import { buildPackageGuides, enrichGuideBlocks } from "./guides.js"
import { ApiSourcePackage } from "./source.js"

const paragraph: GuideBlock = {
  kind: "paragraph",
  parts: Array.of({ kind: "text", text: "Runnable package examples." })
}

const sourcePackage = (directoryName: string, name: string) =>
  Schema.decodeUnknown(ApiSourcePackage)({
    directoryName,
    root: "/workspace/packages",
    description: "Package description.",
    manifest: {
      name,
      version: "1.2.3",
      description: "Package description.",
      exports: Record.empty<string, string>()
    },
    modules: Array.empty()
  })

const guidesFor = (markdown: string, directoryName: string, name: string) =>
  Effect.map(sourcePackage(directoryName, name), (source) =>
    buildPackageGuides({
      example: Option.none(),
      markdown,
      revision: "revision",
      sourcePackage: source
    }))

describe("documentation guide generation", () => {
  it.effect("embeds a package-owned example in an examples guide without code", () =>
    Effect.sync(() => {
      const blocks = enrichGuideBlocks(
        "Examples and reference",
        Array.of(paragraph),
        Option.some({ title: "Quick start", source: "const program = Effect.succeed(1)" })
      )

      expect(blocks).toEqual(Array.make(
        { kind: "heading", depth: 3, id: "quick-start", text: "Quick start" },
        { kind: "code", language: "ts", source: "const program = Effect.succeed(1)" },
        paragraph
      ))
    }))

  it.effect("does not duplicate code already maintained in the package guide", () =>
    Effect.gen(function*() {
      const code = yield* Schema.decodeUnknown(GuideBlockSchema)({
        kind: "code",
        language: "ts",
        source: "Effect.succeed(1)"
      })
      const blocks = enrichGuideBlocks(
        "Examples",
        Array.make(paragraph, code),
        Option.some({ title: "Quick start", source: "Effect.succeed(2)" })
      )

      expect(blocks).toEqual(Array.make(paragraph, code))
    }))

  it.effect("routes directory public modules from README guides to the in-site API reference", () =>
    Effect.gen(function*() {
      const generated = yield* guidesFor(
        "# effect-search\n\nOverview.\n\n## API\n\n[Study](./src/Study/index.ts)",
        "effect-search",
        "@scenesystems/effect-search"
      )
      const page = yield* Array.findFirst(generated.pages, (candidate) => String.Equivalence(candidate.title, "API"))

      expect(page.blocks).toEqual(Array.of({
        kind: "paragraph",
        parts: Array.of({ kind: "link", text: "Study", href: "/docs/effect-search/api/Study" })
      }))
    }))

  it.effect("routes flat public modules from README guides to the in-site API reference", () =>
    Effect.gen(function*() {
      const generated = yield* guidesFor(
        "# effect-math\n\nOverview.\n\n## API\n\n[Policy](./src/Policy.ts)",
        "effect-math",
        "@scenesystems/effect-math"
      )
      const page = yield* Array.findFirst(generated.pages, (candidate) => String.Equivalence(candidate.title, "API"))

      expect(page.blocks).toEqual(Array.of({
        kind: "paragraph",
        parts: Array.of({ kind: "link", text: "Policy", href: "/docs/effect-math/api/Policy" })
      }))
    }))

  it.effect("builds asymmetric guide sections, nested lists, tables, links, and summaries from a README", () =>
    Effect.gen(function*() {
      const source = yield* sourcePackage("effect-math", "@scenesystems/effect-math")
      const generated = buildPackageGuides({
        example: Option.some({ title: "Quick start", source: "const program = Effect.succeed(1)" }),
        markdown:
          "# effect-math\n\nRead the [text package](../effect-text/README.md).\n\n## Installation\n\nInstall the package.\n\n## Basic use\n\n- Outer\n  - Use [Policy](./src/Policy.ts)\n\n## Examples and reference\n\n| Kind | Destination |\n| --- | --- |\n| module | [Study](./src/Study/index.ts) |\n\n## Status\n\nNot a public guide.",
        revision: "revision",
        sourcePackage: source
      })
      const overview = yield* Array.findFirst(
        generated.pages,
        (page) => String.Equivalence(page.title, "@scenesystems/effect-math")
      )
      const gettingStarted = yield* Array.findFirst(
        generated.pages,
        (page) => String.Equivalence(page.title, "Getting started")
      )
      const examples = yield* Array.findFirst(
        generated.pages,
        (page) => String.Equivalence(page.title, "Examples and reference")
      )

      expect(Array.map(generated.pages, (page) => page.title)).toEqual(
        Array.make("@scenesystems/effect-math", "Getting started", "Examples and reference")
      )
      expect(overview.summary).toBe("Read the text package.")
      expect(overview.blocks).toEqual(Array.of({
        kind: "paragraph",
        parts: Array.make(
          { kind: "text", text: "Read the " },
          { kind: "link", text: "text package", href: "/docs/effect-text" },
          { kind: "text", text: "." }
        )
      }))
      expect(gettingStarted.summary).toBe("Install the package.")
      expect(gettingStarted.blocks).toEqual(Array.make(
        { kind: "heading", depth: 2, id: "installation", text: "Installation" },
        { kind: "paragraph", parts: Array.of({ kind: "text", text: "Install the package." }) },
        { kind: "heading", depth: 2, id: "basic-use", text: "Basic use" },
        {
          kind: "list",
          ordered: false,
          items: Array.of(Array.make(
            { kind: "text", text: "Outer" },
            { kind: "text", text: "Use " },
            { kind: "link", text: "Policy", href: "/docs/effect-math/api/Policy" }
          ))
        }
      ))
      expect(examples.summary).toBe("Package description.")
      expect(examples.blocks).toEqual(Array.make(
        { kind: "heading", depth: 3, id: "quick-start", text: "Quick start" },
        { kind: "code", language: "ts", source: "const program = Effect.succeed(1)" },
        {
          kind: "table",
          headers: Array.make(
            Array.of({ kind: "text", text: "Kind" }),
            Array.of({ kind: "text", text: "Destination" })
          ),
          rows: Array.of(Array.make(
            Array.of({ kind: "text", text: "module" }),
            Array.of({ kind: "link", text: "Study", href: "/docs/effect-math/api/Study" })
          ))
        }
      ))
      expect(generated.guides).toEqual(Array.make(
        {
          slug: "getting-started",
          title: "Getting started",
          summary: "Install the package.",
          path: "/docs/effect-math/getting-started",
          asset: "/docs-data/revision/packages/effect-math/guides/getting-started.json"
        },
        {
          slug: "examples-and-reference",
          title: "Examples and reference",
          summary: "Package description.",
          path: "/docs/effect-math/examples-and-reference",
          asset: "/docs-data/revision/packages/effect-math/guides/examples-and-reference.json"
        }
      ))
      expect(Array.map(generated.searchEntries, (entry) => entry.kind)).toEqual(
        Array.make("package", "guide", "guide")
      )
      expect(Array.map(generated.searchEntries, (entry) => entry.category)).toEqual(
        Array.make(Option.none(), Option.some("guide"), Option.some("guide"))
      )
    }))
})
