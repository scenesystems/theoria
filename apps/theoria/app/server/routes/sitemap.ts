import { HttpServerResponse } from "@effect/platform"
import { Effect } from "effect"
import * as Arr from "effect/Array"

import { SiteMetadata } from "../../contracts/presentation/metadata.js"
import { visiblePagePathsForReleaseStage } from "../../contracts/presentation/path.js"
import { serverReleaseStage } from "../config/release-stage.js"

const urlEntry = (loc: string): string => `  <url><loc>${loc}</loc></url>`

export const sitemapRoute = Effect.gen(function*() {
  const stage = yield* serverReleaseStage
  const urls = Arr.map(
    visiblePagePathsForReleaseStage(stage),
    (pathname) => urlEntry(SiteMetadata.fullCanonicalUrl(pathname))
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
