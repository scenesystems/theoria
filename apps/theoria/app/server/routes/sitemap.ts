import { HttpServerResponse } from "@effect/platform"
import { Effect } from "effect"
import * as Arr from "effect/Array"

import { cardsForReleaseStage } from "../../contracts/card.js"
import { fullCanonicalUrl } from "../../contracts/metadata.js"
import { serverReleaseStage } from "../config/release-stage.js"

const urlEntry = (loc: string): string => `  <url><loc>${loc}</loc></url>`

export const sitemapRoute = Effect.gen(function*() {
  const stage = yield* serverReleaseStage
  const visibleCards = cardsForReleaseStage(stage)

  const urls = Arr.prepend(
    Arr.map(visibleCards, (card) => urlEntry(fullCanonicalUrl(card.deepDivePath))),
    urlEntry(fullCanonicalUrl("/"))
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
