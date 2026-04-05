import { FileSystem, HttpServerResponse } from "@effect/platform"
import { Effect, Match, Option, Schema } from "effect"
import * as Arr from "effect/Array"

import { cardByIdForReleaseStage } from "../../contracts/card.js"
import { Id } from "../../contracts/id.js"
import { fullCanonicalUrl, metadataForHome, metadataForId } from "../../contracts/metadata.js"
import type { ReleaseStage } from "../../contracts/release-stage.js"
import { serverReleaseStage } from "../config/release-stage.js"

const fromFileUrl = (url: URL): string => decodeURIComponent(url.pathname)

const distRoot = fromFileUrl(new URL("../../../dist/", import.meta.url))
const indexPath = `${distRoot}index.html`

const RelativeAssetPath = Schema.String.pipe(
  Schema.pattern(/^[A-Za-z0-9._/-]+$/u),
  Schema.filter(
    (value) =>
      !value.startsWith("/")
      && !value.endsWith("/")
      && !value.includes("..")
      && !value.includes("//")
  )
)

const isRelativeAssetPath = Schema.is(RelativeAssetPath)
const isKnownDemoId = Schema.is(Id)
const deepDivePattern = /^\/demos\/([^/]+)\/?$/u
const htmlTagPattern = /<html\b([^>]*)>/u

const deepDiveId = (pathname: string): Option.Option<string> =>
  Option.fromNullable(deepDivePattern.exec(pathname)).pipe(
    Option.flatMap((matches) => Arr.get(matches, 1))
  )

const isHtmlPath = (pathname: string, stage: ReleaseStage): boolean =>
  Match.value(pathname).pipe(
    Match.when("/", () => true),
    Match.when("/index.html", () => true),
    Match.orElse((value) =>
      Option.match(deepDiveId(value), {
        onNone: () => false,
        onSome: (id) => isKnownDemoId(id) && Option.isSome(cardByIdForReleaseStage(id, stage))
      })
    )
  )

const contentType = (
  pathname: string
):
  | "text/html; charset=utf-8"
  | "text/css; charset=utf-8"
  | "application/javascript; charset=utf-8"
  | "application/json; charset=utf-8"
  | "image/svg+xml"
  | "text/plain; charset=utf-8" =>
  pathname.endsWith(".html")
    ? "text/html; charset=utf-8"
    : pathname.endsWith(".css")
    ? "text/css; charset=utf-8"
    : pathname.endsWith(".js")
    ? "application/javascript; charset=utf-8"
    : pathname.endsWith(".json")
    ? "application/json; charset=utf-8"
    : pathname.endsWith(".svg")
    ? "image/svg+xml"
    : "text/plain; charset=utf-8"

const responseHeaders = (pathname: string) => ({
  "cache-control": "no-store",
  "content-type": contentType(pathname)
})

export const notFoundResponse = () =>
  HttpServerResponse.text("Not found", {
    status: 404,
    headers: responseHeaders("/not-found.txt")
  })

const staticAssetPath = (pathname: string, stage: ReleaseStage): Option.Option<string> =>
  Match.value(pathname).pipe(
    Match.when((value) => value.startsWith("/api/"), () => Option.none<string>()),
    Match.when((value) => isHtmlPath(value, stage), () => Option.some(indexPath)),
    Match.orElse((value) => {
      const relativePath = value.startsWith("/") ? value.slice(1) : value
      return isRelativeAssetPath(relativePath)
        ? Option.some(`${distRoot}${relativePath}`)
        : Option.none<string>()
    })
  )

const headerPath = (pathname: string, stage: ReleaseStage): string =>
  isHtmlPath(pathname, stage) ? "/index.html" : pathname

const injectReleaseStage = (html: string, stage: ReleaseStage): string =>
  html.replace(htmlTagPattern, `<html$1 data-theoria-release-stage="${stage}">`)

const titlePattern = /<title>[^<]*<\/title>/u
const metaPattern = (nameOrProperty: string): RegExp =>
  new RegExp(`<meta\\s+(name|property)="${nameOrProperty}"\\s+content="[^"]*"\\s*/?>`, "u")
const canonicalPattern = /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/u

const injectMetadata = (html: string, pathname: string, _stage: ReleaseStage): string => {
  const metadata = Match.value(pathname).pipe(
    Match.when("/", () => metadataForHome()),
    Match.when("/index.html", () => metadataForHome()),
    Match.orElse((value) =>
      Option.match(deepDiveId(value), {
        onNone: () => metadataForHome(),
        onSome: (id) => metadataForId(id)
      })
    )
  )

  const canonicalUrl = fullCanonicalUrl(metadata.canonicalPath)

  return html
    .replace(titlePattern, `<title>${metadata.title}</title>`)
    .replace(metaPattern("description"), `<meta name="description" content="${metadata.description}" />`)
    .replace(metaPattern("og:title"), `<meta property="og:title" content="${metadata.title}" />`)
    .replace(metaPattern("og:description"), `<meta property="og:description" content="${metadata.description}" />`)
    .replace(metaPattern("og:url"), `<meta property="og:url" content="${canonicalUrl}" />`)
    .replace(metaPattern("og:type"), `<meta property="og:type" content="${metadata.ogType}" />`)
    .replace(metaPattern("twitter:title"), `<meta name="twitter:title" content="${metadata.title}" />`)
    .replace(
      metaPattern("twitter:description"),
      `<meta name="twitter:description" content="${metadata.description}" />`
    )
    .replace(canonicalPattern, `<link rel="canonical" href="${canonicalUrl}" />`)
}

export const staticResponse = (pathname: string) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const releaseStage = yield* serverReleaseStage
    const resolvedPath = staticAssetPath(pathname, releaseStage)

    return yield* Option.match(resolvedPath, {
      onNone: () => Effect.succeed(notFoundResponse()),
      onSome: (path) =>
        fileSystem.exists(path).pipe(
          Effect.catchAll(() => Effect.succeed(false)),
          Effect.flatMap((exists) =>
            Match.value(exists).pipe(
              Match.when(true, () =>
                isHtmlPath(pathname, releaseStage)
                  ? fileSystem.readFileString(path).pipe(
                    Effect.map((html) =>
                      injectMetadata(injectReleaseStage(html, releaseStage), pathname, releaseStage)
                    ),
                    Effect.flatMap((html) =>
                      HttpServerResponse.text(html, {
                        status: 200,
                        headers: responseHeaders(headerPath(pathname, releaseStage))
                      })
                    ),
                    Effect.catchAll(() => Effect.succeed(notFoundResponse()))
                  )
                  : HttpServerResponse.file(path, {
                    headers: responseHeaders(headerPath(pathname, releaseStage))
                  }).pipe(Effect.catchAll(() => Effect.succeed(notFoundResponse())))),
              Match.orElse(() => Effect.succeed(notFoundResponse()))
            )
          )
        )
    })
  })
