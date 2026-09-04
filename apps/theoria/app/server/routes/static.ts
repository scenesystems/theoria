import { HttpServerResponse } from "@effect/platform"
import { Effect, Match, Option, Schema } from "effect"

import type { DocsManifest } from "@theoria/docs-model"
import { headEntries } from "../../contracts/head.js"
import { docsPathExists, metadataForDocs, metadataForHome, type PageMetadata } from "../../contracts/metadata.js"
import { injectAnalytics, requestAnalytics } from "../analytics.js"
import { DocsManifestStore } from "../config/docs-manifest-store.js"
import { contentTypeForPath, StaticStore } from "../config/static-store.js"
import { renderHead } from "../render-head.js"

const indexPathname = "/index.html"

const AssetPathname = Schema.String.pipe(
  Schema.pattern(/^\/[A-Za-z0-9._/-]+$/u),
  Schema.filter((value) => !value.endsWith("/") && !value.includes("..") && !value.includes("//"))
)

const isAssetPathname = Schema.is(AssetPathname)

const isDocsPath = (pathname: string): boolean => pathname === "/docs" || pathname.startsWith("/docs/")

export const isHtmlPath = (pathname: string): boolean =>
  Match.value(pathname).pipe(
    Match.when("/", () => true),
    Match.when(indexPathname, () => true),
    Match.orElse(isDocsPath)
  )

export const cacheControlForPath = (pathname: string): string =>
  pathname === indexPathname || pathname === "/docs-data/manifest.json"
    ? "no-cache"
    : pathname.startsWith("/assets/") || /^\/docs-data\/[A-Za-z0-9._-]+\//u.test(pathname)
    ? "public, max-age=31536000, immutable"
    : "public, max-age=3600"

const responseHeaders = (pathname: string) => ({
  "cache-control": cacheControlForPath(pathname)
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
const isPrivatePath = (pathname: string): boolean => pathname.startsWith("/api/")

const metadataForPath = (pathname: string, docsManifest: Option.Option<DocsManifest>): PageMetadata =>
  isDocsPath(pathname)
    ? Option.match(docsManifest, {
      onNone: metadataForHome,
      onSome: (manifest) => metadataForDocs(manifest, pathname)
    })
    : metadataForHome()

const injectMetadata = (html: string, pathname: string, docsManifest: Option.Option<DocsManifest>): string =>
  renderHead(html, headEntries(metadataForPath(pathname, docsManifest)))

const htmlStatus = (pathname: string, manifest: Option.Option<DocsManifest>): 200 | 404 =>
  isDocsPath(pathname)
    && Option.exists(manifest, (docsManifest) => !docsPathExists(docsManifest, pathname))
    ? 404
    : 200

const htmlResponse = (pathname: string) =>
  Effect.gen(function*() {
    const store = yield* StaticStore
    const docsManifestStore = yield* DocsManifestStore
    const docsManifest = isDocsPath(pathname)
      ? yield* Effect.option(docsManifestStore.manifest)
      : Option.none()
    const analytics = yield* requestAnalytics
    const html = yield* store.text(indexPathname)

    return HttpServerResponse.text(injectAnalytics(injectMetadata(html, pathname, docsManifest), analytics), {
      status: htmlStatus(pathname, docsManifest),
      headers: {
        ...responseHeaders(indexPathname),
        "content-type": contentTypeForPath(indexPathname),
        // llmstxt.org: point agents at the file that describes every page.
        link: `</llms.txt>; rel="describedby"`
      }
    })
  }).pipe(Effect.catchAll(() => Effect.succeed(notFoundResponse())))

const assetResponse = (pathname: string) =>
  Effect.gen(function*() {
    const store = yield* StaticStore
    const asset = yield* store.response(pathname)

    return Option.match(asset, {
      onNone: notFoundResponse,
      onSome: HttpServerResponse.setHeaders(responseHeaders(pathname))
    })
  })

export const staticResponse = (pathname: string) =>
  Match.value(pathname).pipe(
    Match.when(isPrivatePath, () => Effect.succeed(notFoundResponse())),
    Match.when(isHtmlPath, htmlResponse),
    Match.when(isAssetPathname, assetResponse),
    Match.orElse(() => Effect.succeed(notFoundResponse()))
  )
