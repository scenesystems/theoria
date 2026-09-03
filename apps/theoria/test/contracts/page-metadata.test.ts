import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"
import * as Arr from "effect/Array"

import { headEntries, type HeadEntry } from "../../app/contracts/head.js"
import { metadataForDocs, metadataForHome } from "../../app/contracts/metadata.js"
import { structuredDataJson } from "../../app/contracts/structured-data.js"
import { renderHead } from "../../app/server/render-head.js"
import { docsManifestFixture } from "../helpers/docs-fixtures.js"

const Graph = Schema.parseJson(Schema.Struct({
  "@context": Schema.Literal("https://schema.org"),
  "@graph": Schema.Array(Schema.Struct({ "@type": Schema.String }, { key: Schema.String, value: Schema.Unknown }))
}))

const graphOf = (json: string) => Schema.decodeUnknownSync(Graph)(json)["@graph"]

const metaContent = (entries: ReadonlyArray<HeadEntry>, key: string) =>
  Arr.findFirst(entries, (entry) => entry._tag === "Meta" && entry.key === key).pipe(
    (found) => found._tag === "Some" && found.value._tag === "Meta" ? found.value.content : ""
  )

const shell = [
  "<title>x</title>",
  "<meta name=\"description\" content=\"x\" />",
  "<meta name=\"robots\" content=\"x\" />",
  "<meta property=\"og:title\" content=\"x\" />",
  "<meta property=\"og:description\" content=\"x\" />",
  "<meta property=\"og:url\" content=\"x\" />",
  "<meta property=\"og:type\" content=\"x\" />",
  "<meta property=\"og:image\" content=\"x\" />",
  "<meta property=\"og:image:alt\" content=\"x\" />",
  "<meta name=\"twitter:title\" content=\"x\" />",
  "<meta name=\"twitter:description\" content=\"x\" />",
  "<meta name=\"twitter:image\" content=\"x\" />",
  "<meta name=\"twitter:image:alt\" content=\"x\" />",
  "<link rel=\"canonical\" href=\"x\" />",
  "<script type=\"application/ld+json\" id=\"structured-data\">{}</script>"
].join("\n")

describe("page metadata", () => {
  it.effect("gives package pages their own share image and a SoftwareSourceCode graph", () =>
    Effect.sync(() => {
      const metadata = metadataForDocs(docsManifestFixture, "/docs/effect-search")

      expect(metadata.image.path).toBe("/social/effect-search.png")
      expect(metadata.indexable).toBe(true)
      expect(Arr.map(metadata.breadcrumbs, (crumb) => crumb.path)).toEqual(["/docs", "/docs/effect-search"])

      const graph = graphOf(structuredDataJson(metadata))
      expect(Arr.map(graph, (node) => node["@type"])).toEqual([
        "SoftwareSourceCode",
        "BreadcrumbList",
        "WebSite",
        "Organization"
      ])
      expect(graph[0]).toMatchObject({
        name: "@scenesystems/effect-search",
        version: "1.2.3",
        codeRepository: "https://github.com/scenesystems/theoria/tree/main/packages/effect-search",
        url: "https://theoria.scenesystems.io/docs/effect-search"
      })
    }))

  it.effect("describes guides and API modules as TechArticles about their package", () =>
    Effect.sync(() => {
      const guide = metadataForDocs(docsManifestFixture, "/docs/effect-search/getting-started/")
      const graph = graphOf(structuredDataJson(guide))

      expect(guide.title).toBe("Getting started — @scenesystems/effect-search — Theoria")
      expect(guide.image.path).toBe("/social/effect-search.png")
      expect(graph[0]).toMatchObject({
        "@type": "TechArticle",
        headline: "Getting started",
        about: { name: "@scenesystems/effect-search" }
      })
      expect(graph[1]).toMatchObject({
        "@type": "BreadcrumbList",
        itemListElement: [
          { position: 1, name: "Theoria" },
          { position: 2, name: "Packages" },
          { position: 3, name: "@scenesystems/effect-search" },
          { position: 4, name: "Getting started" }
        ]
      })
    }))

  it.effect("keeps unknown docs paths out of the index and shares the site card", () =>
    Effect.sync(() => {
      const missing = metadataForDocs(docsManifestFixture, "/docs/effect-search/nope")
      const entries = headEntries(missing)

      expect(missing.indexable).toBe(false)
      expect(metaContent(entries, "robots")).toBe("noindex, follow")
      expect(metaContent(entries, "og:image")).toBe("https://theoria.scenesystems.io/social/theoria.png")
      expect(Arr.map(graphOf(structuredDataJson(missing)), (node) => node["@type"])).toEqual([
        "WebSite",
        "Organization"
      ])
    }))

  it.effect("links the home page to the organization published on scenesystems.io", () =>
    Effect.sync(() => {
      const graph = graphOf(structuredDataJson(metadataForHome()))

      expect(graph).toHaveLength(2)
      expect(graph[0]).toMatchObject({
        "@type": "WebSite",
        publisher: { "@id": "https://scenesystems.io/#organization" }
      })
      expect(graph[1]).toMatchObject({ "@type": "Organization", "@id": "https://scenesystems.io/#organization" })
    }))

  it.effect("rewrites every placeholder in the shell exactly once, escaped", () =>
    Effect.sync(() => {
      const metadata = metadataForDocs(docsManifestFixture, "/docs/effect-search/getting-started")
      const html = renderHead(shell, headEntries(metadata))

      expect(html).not.toContain("\"x\"")
      expect(html).not.toContain("<title>x</title>")
      expect(html).toContain("<title>Getting started — @scenesystems/effect-search — Theoria</title>")
      expect(html).toContain("<meta name=\"robots\" content=\"index, follow, max-image-preview:large\" />")
      expect(html).toContain(
        "<meta name=\"twitter:image\" content=\"https://theoria.scenesystems.io/social/effect-search.png\" />"
      )
      expect(html).toContain(
        "<link rel=\"canonical\" href=\"https://theoria.scenesystems.io/docs/effect-search/getting-started\" />"
      )
      expect(html).toContain("<script type=\"application/ld+json\" id=\"structured-data\">{\"@context\"")
      expect(html).not.toContain("{}</script>")
    }))

  it.effect("never lets </script> appear inside the structured data", () =>
    Effect.sync(() => {
      const hostile = {
        ...metadataForDocs(docsManifestFixture, "/docs"),
        description: "</script><script>alert(1)</script>"
      }

      expect(structuredDataJson(hostile)).not.toContain("</script>")
      expect(structuredDataJson(hostile)).toContain("\\u003c/script>")
    }))
})
