import { HttpServerResponse } from "@effect/platform"
import { Effect } from "effect"
import * as Arr from "effect/Array"

import type { DocsManifest } from "@theoria/docs-model"
import { fullCanonicalUrl } from "../../contracts/metadata.js"
import { DocsManifestStore } from "../config/docs-manifest-store.js"

const urlEntry = (loc: string): string => `  <url><loc>${loc}</loc></url>`

export const docsSitemapPaths = (manifest: DocsManifest): ReadonlyArray<string> =>
  Arr.prepend(
    Arr.flatMap(manifest.packages, (docsPackage) =>
      Arr.prepend(
        Arr.appendAll(
          Arr.map(docsPackage.guides, (guide) => guide.path),
          Arr.map(docsPackage.apiModules, (module) => module.path)
        ),
        docsPackage.overview.path
      )),
    "/docs"
  )

export const sitemapRoute = Effect.gen(function*() {
  const docsManifestStore = yield* DocsManifestStore
  const docsPaths = docsSitemapPaths(yield* docsManifestStore.manifest)

  const urls = Arr.map(
    Arr.prepend(docsPaths, "/"),
    (path) => urlEntry(fullCanonicalUrl(path))
  )

  const xml = Arr.join(
    Arr.append(
      Arr.prependAll(urls, [
        `<?xml version="1.0" encoding="UTF-8"?>`,
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`
      ]),
      `</urlset>`
    ),
    "\n"
  )

  return HttpServerResponse.text(xml, {
    status: 200,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600"
    }
  })
})
