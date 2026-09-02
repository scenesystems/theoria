import { HttpServerResponse } from "@effect/platform"
import { Effect, Match, Option, Schema } from "effect"
import * as Arr from "effect/Array"

import type { DocsManifest } from "@theoria/docs-model"
import { cardByIdForReleaseStage } from "../../contracts/card.js"
import { Id } from "../../contracts/id.js"
import {
  docsPathExists,
  fullCanonicalUrl,
  metadataForDocs,
  metadataForHome,
  metadataForId
} from "../../contracts/metadata.js"
import type { ReleaseStage } from "../../contracts/release-stage.js"
import { DocsCatalog } from "../config/docs-catalog.js"
import { serverReleaseStage } from "../config/release-stage.js"
import { contentTypeForPath, runtimeDataPrefix, StaticStore } from "../config/static-store.js"

const indexPathname = "/index.html"

const AssetPathname = Schema.String.pipe(
  Schema.pattern(/^\/[A-Za-z0-9._/-]+$/u),
  Schema.filter((value) => !value.endsWith("/") && !value.includes("..") && !value.includes("//"))
)

const isAssetPathname = Schema.is(AssetPathname)
const isKnownDemoId = Schema.is(Id)
const deepDivePattern = /^\/demos\/([^/]+)\/?$/u

const deepDiveId = (pathname: string): Option.Option<string> =>
  Option.fromNullable(deepDivePattern.exec(pathname)).pipe(
    Option.flatMap((matches) => Arr.get(matches, 1))
  )

const isDocsPath = (pathname: string): boolean => pathname === "/docs" || pathname.startsWith("/docs/")

export const isHtmlPath = (pathname: string, stage: ReleaseStage): boolean =>
  Match.value(pathname).pipe(
    Match.when("/", () => true),
    Match.when(indexPathname, () => true),
    Match.orElse((value) =>
      isDocsPath(value) ||
      Option.match(deepDiveId(value), {
        onNone: () => false,
        onSome: (id) => isKnownDemoId(id) && Option.isSome(cardByIdForReleaseStage(id, stage))
      })
    )
  )

export const cacheControlForPath = (pathname: string): string =>
  pathname === indexPathname || pathname === "/docs-data/manifest.json"
    ? "no-cache"
    : pathname.startsWith("/assets/") || /^\/docs-data\/[A-Za-z0-9._-]+\//u.test(pathname)
    ? "public, max-age=31536000, immutable"
    : "public, max-age=3600"

const responseHeaders = (pathname: string) => ({
  "cache-control": cacheControlForPath(pathname),
  vary: "accept-encoding"
})

export const notFoundResponse = () =>
  HttpServerResponse.text("Not found", {
    status: 404,
    headers: {
      ...responseHeaders("/not-found.txt"),
      "content-type": contentTypeForPath("/not-found.txt")
    }
  })

/** Pathnames the public server refuses to serve even when a matching asset exists. */
const isPrivatePath = (pathname: string): boolean =>
  pathname.startsWith("/api/") || pathname.startsWith(runtimeDataPrefix)

const titlePattern = /<title>[^<]*<\/title>/u
const metaPattern = (nameOrProperty: string): RegExp =>
  new RegExp(`<meta\\s+(name|property)="${nameOrProperty}"\\s+content="[^"]*"\\s*/?>`, "u")
const canonicalPattern = /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/u

const escaped = (value: string): string =>
  value.replace(/[&<>"']/gu, (character) =>
    Match.value(character).pipe(
      Match.when("&", () => "&amp;"),
      Match.when("<", () => "&lt;"),
      Match.when(">", () => "&gt;"),
      Match.when("\"", () => "&quot;"),
      Match.orElse(() => "&#39;")
    ))

const injectMetadata = (
  html: string,
  pathname: string,
  docsManifest: Option.Option<DocsManifest>
): string => {
  const metadata = Match.value(pathname).pipe(
    Match.when("/", () => metadataForHome()),
    Match.when(indexPathname, () => metadataForHome()),
    Match.orElse((value) =>
      isDocsPath(value)
        ? Option.match(docsManifest, {
          onNone: metadataForHome,
          onSome: (manifest) => metadataForDocs(manifest, value)
        })
        : Option.match(deepDiveId(value), {
          onNone: () => metadataForHome(),
          onSome: (id) => metadataForId(id)
        })
    )
  )

  const canonicalUrl = escaped(fullCanonicalUrl(metadata.canonicalPath))
  const title = escaped(metadata.title)
  const description = escaped(metadata.description)

  return html
    .replace(titlePattern, `<title>${title}</title>`)
    .replace(metaPattern("description"), `<meta name="description" content="${description}" />`)
    .replace(metaPattern("og:title"), `<meta property="og:title" content="${title}" />`)
    .replace(metaPattern("og:description"), `<meta property="og:description" content="${description}" />`)
    .replace(metaPattern("og:url"), `<meta property="og:url" content="${canonicalUrl}" />`)
    .replace(metaPattern("og:type"), `<meta property="og:type" content="${metadata.ogType}" />`)
    .replace(metaPattern("twitter:title"), `<meta name="twitter:title" content="${title}" />`)
    .replace(
      metaPattern("twitter:description"),
      `<meta name="twitter:description" content="${description}" />`
    )
    .replace(canonicalPattern, `<link rel="canonical" href="${canonicalUrl}" />`)
}

const htmlStatus = (pathname: string, manifest: Option.Option<DocsManifest>): 200 | 404 =>
  isDocsPath(pathname)
    && Option.exists(manifest, (docsManifest) => !docsPathExists(docsManifest, pathname))
    ? 404
    : 200

const htmlResponse = (pathname: string) =>
  Effect.gen(function*() {
    const store = yield* StaticStore
    const docsCatalog = yield* DocsCatalog
    const docsManifest = isDocsPath(pathname)
      ? yield* Effect.option(docsCatalog.manifest)
      : Option.none()
    const html = yield* store.text(indexPathname)

    return HttpServerResponse.text(injectMetadata(html, pathname, docsManifest), {
      status: htmlStatus(pathname, docsManifest),
      headers: {
        ...responseHeaders(indexPathname),
        "content-type": contentTypeForPath(indexPathname)
      }
    })
  }).pipe(Effect.catchAll(() => Effect.succeed(notFoundResponse())))

const assetResponse = (pathname: string, acceptEncoding: Option.Option<string>) =>
  Effect.gen(function*() {
    const store = yield* StaticStore
    const asset = yield* store.response(pathname, acceptEncoding)

    return Option.match(asset, {
      onNone: notFoundResponse,
      onSome: HttpServerResponse.setHeaders(responseHeaders(pathname))
    })
  })

export const staticResponse = (pathname: string, acceptEncoding: Option.Option<string>) =>
  Effect.gen(function*() {
    const releaseStage = yield* serverReleaseStage

    return yield* Match.value(pathname).pipe(
      Match.when(isPrivatePath, () => Effect.succeed(notFoundResponse())),
      Match.when((value) => isHtmlPath(value, releaseStage), htmlResponse),
      Match.when(isAssetPathname, (value) => assetResponse(value, acceptEncoding)),
      Match.orElse(() => Effect.succeed(notFoundResponse()))
    )
  })
