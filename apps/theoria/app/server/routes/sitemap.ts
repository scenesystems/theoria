import { HttpServerResponse } from "@effect/platform"
import { Effect, Option } from "effect"
import * as Arr from "effect/Array"

import type { DocsManifest } from "@theoria/docs-model"
import { fullCanonicalUrl } from "../../contracts/metadata.js"
import { DocsManifestStore } from "../config/docs-manifest-store.js"

const urlEntry = (loc: string): string => `  <url><loc>${loc}</loc></url>`

export const docsSitemapPaths = (manifest: DocsManifest): ReadonlyArray<string> =>
  Arr.prepend(
    Arr.flatMap(manifest.packages, (docsPackage) => [
      docsPackage.overview.path,
      ...Arr.map(docsPackage.guides, (guide) => guide.path),
      ...Arr.map(docsPackage.apiModules, (module) => module.path)
    ]),
    "/docs"
  )

export const sitemapRoute = Effect.gen(function*() {
  const docsManifestStore = yield* DocsManifestStore
  const docsManifest = yield* Effect.option(docsManifestStore.manifest)
  const docsPaths = Option.match(docsManifest, {
    onNone: () => ["/docs"],
    onSome: docsSitemapPaths
  })

  const urls = Arr.map(
    ["/", ...docsPaths],
    (path) => urlEntry(fullCanonicalUrl(path))
  )

  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`
  ].join("\n")

  return HttpServerResponse.text(xml, {
    status: 200,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600"
    }
  })
})
