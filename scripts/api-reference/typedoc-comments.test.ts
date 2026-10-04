import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"
import { normalizePath, ReflectionSymbolId } from "typedoc"

import { ApiDocContext, docParts } from "./typedoc-comments.js"

const context = new ApiDocContext({
  packageName: "@scenesystems/example",
  route: {
    subpath: "./Example",
    slug: "Example",
    canonical: true,
    path: "/docs/example/api/Example",
    page: "packages/example/pages/Example.json",
    imports: []
  },
  links: []
})

const link = (target: ReflectionSymbolId, docContext = context) =>
  docParts([{ kind: "inline-tag", tag: "@link", text: "BottomWithoutNew.makeEffect", target }], docContext)

describe("TypeDoc comment links", () => {
  it.effect("resolves inherited Effect symbols without confusing identically named workspace exports", () =>
    Effect.sync(() => {
      const parts = link(
        new ReflectionSymbolId({
          packageName: "effect",
          packagePath: normalizePath("src/Schema.ts"),
          qualifiedName: "BottomWithoutNew.makeEffect"
        }),
        new ApiDocContext({
          packageName: context.packageName,
          route: context.route,
          links: [[context.packageName, "makeEffect", "/docs/example/api/Example#api-makeEffect"]]
        })
      )

      expect(parts).toEqual([{
        kind: "link",
        text: "BottomWithoutNew.makeEffect",
        href: Option.some("https://effect.website/docs/v4/api/effect/Schema")
      }])
    }))

  it.effect("does not bless unresolved authored workspace symbols", () =>
    Effect.sync(() => {
      const parts = link(
        new ReflectionSymbolId({
          packageName: "@scenesystems/example",
          packagePath: normalizePath("src/Example.ts"),
          qualifiedName: "missing"
        })
      )

      expect(parts).toEqual([{
        kind: "link",
        text: "BottomWithoutNew.makeEffect",
        href: Option.none()
      }])
    }))
})
