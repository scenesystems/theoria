import { HttpServerRequest, HttpServerResponse } from "@effect/platform"
import { Boolean as Bool, Effect, Equal, Match, Option, Schema } from "effect"
import * as Arr from "effect/Array"
import * as Str from "effect/String"

import type { DocsManifest } from "@theoria/docs-model"
import {
  colorModeCookieName,
  ColorModeCookies,
  type ColorModePreference,
  rootClassForPreference
} from "../../contracts/color-mode.js"
import { headEntries } from "../../contracts/head.js"
import { docsPathExists, metadataForDocs, metadataForHome, type PageMetadata } from "../../contracts/metadata.js"
import { injectAnalytics, requestAnalytics } from "../analytics.js"
import { DocsManifestStore } from "../config/docs-manifest-store.js"
import { htmlContentType, StaticStore, textContentType } from "../config/static-store.js"
import { renderHead } from "../render-head.js"

const indexPathname = "/index.html"
const docsManifestPathname = "/docs-data/manifest.json"

const AssetPathname = Schema.String.pipe(
  Schema.pattern(/^\/[A-Za-z0-9._/-]+$/u),
  Schema.filter((value) =>
    Bool.not(Bool.some([Str.endsWith("/")(value), Str.includes("..")(value), Str.includes("//")(value)]))
  )
)

const isAssetPathname = Schema.is(AssetPathname)

const isDocsPath = (pathname: string): boolean =>
  Bool.or(Equal.equals(pathname, "/docs"), Str.startsWith("/docs/")(pathname))

export const isHtmlPath = (pathname: string): boolean =>
  Match.value(pathname).pipe(
    Match.when("/", () => true),
    Match.when(indexPathname, () => true),
    Match.orElse(isDocsPath)
  )

/** A versioned docs-data file: everything under a revision directory is immutable. */
const isVersionedDocsData = (pathname: string): boolean => /^\/docs-data\/[A-Za-z0-9._-]+\//u.test(pathname)

export const cacheControlForPath = (pathname: string): string =>
  Match.value(pathname).pipe(
    Match.when(indexPathname, () => "no-cache"),
    Match.when(docsManifestPathname, () => "no-cache"),
    Match.when(Str.startsWith("/assets/"), () => "public, max-age=31536000, immutable"),
    Match.when(isVersionedDocsData, () => "public, max-age=31536000, immutable"),
    Match.orElse(() => "public, max-age=3600")
  )

const responseHeaders = (pathname: string) => ({
  "cache-control": cacheControlForPath(pathname)
})

export const notFoundResponse = () =>
  HttpServerResponse.text("Not found", {
    status: 404,
    headers: {
      ...responseHeaders("/not-found.txt"),
      "content-type": textContentType
    }
  })

/** Pathnames the public server refuses to serve even when a matching asset exists. */
const isPrivatePath = (pathname: string): boolean => Str.startsWith("/api/")(pathname)

const metadataForPath = (pathname: string, docsManifest: Option.Option<DocsManifest>): PageMetadata =>
  Option.match(docsManifest, {
    onNone: metadataForHome,
    onSome: (manifest) => metadataForDocs(manifest, pathname)
  })

/**
 * The reader's colour-mode preference from the request's cookie. A missing
 * cookie is no preference; so is one the schema rejects, since the browser
 * will write a well-formed one at its next chance and the shell without a
 * class is the light shell every reader got before.
 */
const colorModePreference: Effect.Effect<
  Option.Option<ColorModePreference>,
  never,
  HttpServerRequest.HttpServerRequest
> = HttpServerRequest.schemaCookies(ColorModeCookies).pipe(
  Effect.map((cookies) => cookies[colorModeCookieName]),
  Effect.catchTag("ParseError", () => Effect.succeedNone)
)

const injectMetadata = (
  html: string,
  pathname: string,
  docsManifest: Option.Option<DocsManifest>,
  preference: Option.Option<ColorModePreference>
): string =>
  renderHead(
    html,
    Arr.append(headEntries(metadataForPath(pathname, docsManifest)), rootClassForPreference(preference))
  )

/** A docs path the manifest does not know is served as the shell with a 404, so the router can still show "Not found". */
const htmlStatus = (manifest: Option.Option<DocsManifest>, pathname: string): 200 | 404 =>
  Bool.match(Option.exists(manifest, (docsManifest) => Bool.not(docsPathExists(docsManifest, pathname))), {
    onTrue: (): 200 | 404 => 404,
    onFalse: (): 200 | 404 => 200
  })

const htmlResponse = (pathname: string) =>
  Effect.gen(function*() {
    const store = yield* StaticStore
    const docsManifestStore = yield* DocsManifestStore
    const docsManifest = yield* Bool.match(isDocsPath(pathname), {
      onTrue: () => Effect.asSome(docsManifestStore.manifest),
      onFalse: () => Effect.succeedNone
    })
    const analytics = yield* requestAnalytics
    const preference = yield* colorModePreference
    const html = yield* store.text(indexPathname)

    return HttpServerResponse.text(
      injectAnalytics(injectMetadata(html, pathname, docsManifest, preference), analytics),
      {
        status: htmlStatus(docsManifest, pathname),
        headers: {
          ...responseHeaders(indexPathname),
          "content-type": htmlContentType,
          // llmstxt.org: point agents at the file that describes every page.
          link: `</llms.txt>; rel="describedby"`,
          // The shell is served in the reader's colour mode, so a cache must key on the cookie.
          vary: "Cookie"
        }
      }
    )
  })

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
