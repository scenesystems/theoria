import { FileSystem, HttpServerResponse } from "@effect/platform"
import { Effect, Match, Option, Schema } from "effect"

import { fullCanonicalUrl, metadataForPathname } from "../../contracts/presentation/metadata.js"
import {
  isHtmlPagePath,
  isPackageDocsLandingPath,
  packageDocsLandingRedirectPathForReleaseStage
} from "../../contracts/presentation/path.js"
import type { ReleaseStage } from "../../contracts/release-stage.js"
import { serverReleaseStage } from "../config/release-stage.js"

const searchFromUrl = (rawUrl: string): string => new URL(rawUrl, "http://127.0.0.1").search

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
const htmlTagPattern = /<html\b([^>]*)>/u

const isHtmlPath = (pathname: string, rawUrl: string, stage: ReleaseStage): boolean =>
  isHtmlPagePath(pathname, stage, searchFromUrl(rawUrl))

const packageDocsRedirectPath = (pathname: string, rawUrl: string, stage: ReleaseStage): string | null => {
  const search = searchFromUrl(rawUrl)
  return isPackageDocsLandingPath(pathname, search)
    ? packageDocsLandingRedirectPathForReleaseStage(stage)
    : null
}

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

const staticAssetPath = (pathname: string, rawUrl: string, stage: ReleaseStage): Option.Option<string> =>
  Match.value(pathname).pipe(
    Match.when((value) => value.startsWith("/api/"), () => Option.none<string>()),
    Match.when((value) => isHtmlPath(value, rawUrl, stage), () => Option.some(indexPath)),
    Match.orElse((value) => {
      const relativePath = value.startsWith("/") ? value.slice(1) : value
      return isRelativeAssetPath(relativePath)
        ? Option.some(`${distRoot}${relativePath}`)
        : Option.none<string>()
    })
  )

const headerPath = (pathname: string, rawUrl: string, stage: ReleaseStage): string =>
  isHtmlPath(pathname, rawUrl, stage) ? "/index.html" : pathname

const injectReleaseStage = (html: string, stage: ReleaseStage): string =>
  html.replace(htmlTagPattern, `<html$1 data-theoria-release-stage="${stage}">`)

const titlePattern = /<title>[^<]*<\/title>/u
const metaPattern = (nameOrProperty: string): RegExp =>
  new RegExp(`<meta\\s+(name|property)="${nameOrProperty}"\\s+content="[^"]*"\\s*/?>`, "u")
const canonicalPattern = /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/u

const injectMetadata = (html: string, pathname: string, rawUrl: string): string => {
  const search = new URL(rawUrl, "http://127.0.0.1").search
  const metadata = metadataForPathname(pathname, search)

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

export const staticResponse = (pathname: string, rawUrl: string) =>
  Effect.gen(function*() {
    const releaseStage = yield* serverReleaseStage
    const redirectPath = packageDocsRedirectPath(pathname, rawUrl, releaseStage)

    if (redirectPath !== null) {
      return HttpServerResponse.redirect(redirectPath, {
        status: 302,
        headers: {
          "cache-control": "no-store"
        }
      })
    }

    const fileSystem = yield* FileSystem.FileSystem
    const resolvedPath = staticAssetPath(pathname, rawUrl, releaseStage)

    return yield* Option.match(resolvedPath, {
      onNone: () => Effect.succeed(notFoundResponse()),
      onSome: (path) =>
        fileSystem.exists(path).pipe(
          Effect.catchAll(() => Effect.succeed(false)),
          Effect.flatMap((exists) =>
            Match.value(exists).pipe(
              Match.when(true, () =>
                isHtmlPath(pathname, rawUrl, releaseStage)
                  ? fileSystem.readFileString(path).pipe(
                    Effect.map((html) => injectMetadata(injectReleaseStage(html, releaseStage), pathname, rawUrl)),
                    Effect.flatMap((html) =>
                      HttpServerResponse.text(html, {
                        status: 200,
                        headers: responseHeaders(headerPath(pathname, rawUrl, releaseStage))
                      })
                    ),
                    Effect.catchAll(() => Effect.succeed(notFoundResponse()))
                  )
                  : HttpServerResponse.file(path, {
                    headers: responseHeaders(headerPath(pathname, rawUrl, releaseStage))
                  }).pipe(Effect.catchAll(() => Effect.succeed(notFoundResponse())))),
              Match.orElse(() => Effect.succeed(notFoundResponse()))
            )
          )
        )
    })
  })
