import { describe, expect, it } from "@effect/vitest"
import { Array, Effect, Option } from "effect"
import { type DocsSearchEntry, prepareDocsSearchIndex, searchDocs } from "../src/index.js"

const entry = (
  id: string,
  name: string,
  packageSlug = "search",
  kind: DocsSearchEntry["kind"] = "symbol"
): DocsSearchEntry => ({
  id,
  kind,
  package: packageSlug,
  packageSlug,
  name,
  qualifiedName: name,
  category: Option.none(),
  summary: "",
  path: `/docs/${id}`,
  anchor: Option.none()
})

describe("documentation search", () => {
  it.effect("ranks exact matches before prefixes, supports typos, and rejects unrelated tokens", () =>
    Effect.gen(function*() {
      const index = prepareDocsSearchIndex([
        entry("prefix", "runStudyLater"),
        entry("exact", "runStudy"),
        entry("unrelated", "compile")
      ])
      const search = (query: string) =>
        Array.map(searchDocs(index, query, { limit: 10, packageSlug: Option.none() }), (value) => value.id)
      expect(search("runStudy")).toEqual(["exact", "prefix"])
      expect(search("run stduy")).toEqual(["exact", "prefix"])
      expect(search("run stuy")).toEqual(["exact", "prefix"])
      expect(search("run sty")).toEqual([])
      expect(search("run unknown")).toEqual([])
      expect(search("xy")).toEqual([])
    }))

  it.effect("normalizes Unicode and preserves source order for equal nonempty-query scores", () =>
    Effect.gen(function*() {
      const index = prepareDocsSearchIndex([entry("first", "ＲÉSUMÉ"), entry("second", "résumé")])
      expect(
        Array.map(searchDocs(index, "  resume!!! ", { limit: 10, packageSlug: Option.none() }), (value) => value.id)
      )
        .toEqual(["first", "second"])
    }))

  it.effect("boosts the selected package without filtering other packages and applies limits", () =>
    Effect.gen(function*() {
      const index = prepareDocsSearchIndex([entry("first", "runStudy", "one"), entry("second", "runStudy", "two")])
      expect(
        Array.map(searchDocs(index, "runStudy", { limit: 2, packageSlug: Option.some("two") }), (value) => value.id)
      )
        .toEqual(["second", "first"])
      expect(
        Array.map(searchDocs(index, "runStudy", { limit: 1, packageSlug: Option.some("two") }), (value) => value.id)
      )
        .toEqual(["second"])
      expect(searchDocs(index, "runStudy", { limit: 0, packageSlug: Option.none() })).toEqual([])
    }))

  it.effect("orders empty-query categories and handles empty indexes", () =>
    Effect.gen(function*() {
      const index = prepareDocsSearchIndex([
        entry("symbol", "runStudy"),
        entry("module", "Study", "search", "module"),
        entry("guide", "Start", "search", "guide"),
        entry("package", "Search", "search", "package")
      ])
      expect(Array.map(searchDocs(index, "", { limit: 10, packageSlug: Option.none() }), (value) => value.id))
        .toEqual(["package", "guide", "module"])
      expect(searchDocs(prepareDocsSearchIndex([]), "study", { limit: 10, packageSlug: Option.none() })).toEqual([])
    }))
})
