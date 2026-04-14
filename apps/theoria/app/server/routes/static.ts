import { FileSystem, HttpServerResponse } from "@effect/platform"
import { Effect, Match, Option, Schema } from "effect"

import { SiteMetadata } from "../../contracts/presentation/metadata.js"
import { PageLocation } from "../../contracts/presentation/page-location.js"
import { PagePresentation } from "../../contracts/presentation/page.js"
import { PackageDocsRoute, PageRoute } from "../../contracts/presentation/path.js"
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
const htmlTagPattern = /<html\b([^>]*)>/u

const isHtmlPath = (location: PageLocation, stage: ReleaseStage): boolean => PageRoute.isHtmlLocation(location, stage)

const packageDocsRedirectPath = (location: PageLocation, stage: ReleaseStage): string | null => {
  return PackageDocsRoute.isLandingLocation(location)
    ? PackageDocsRoute.redirectPathForReleaseStage(stage)
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

const staticAssetPath = (location: PageLocation, stage: ReleaseStage): Option.Option<string> =>
  Match.value(location.pathname).pipe(
    Match.when((value) => value.startsWith("/api/"), () => Option.none<string>()),
    Match.when(() => isHtmlPath(location, stage), () => Option.some(indexPath)),
    Match.orElse((value) => {
      const relativePath = value.startsWith("/") ? value.slice(1) : value
      return isRelativeAssetPath(relativePath)
        ? Option.some(`${distRoot}${relativePath}`)
        : Option.none<string>()
    })
  )

const headerPath = (location: PageLocation, stage: ReleaseStage): string =>
  isHtmlPath(location, stage) ? "/index.html" : location.pathname

const injectReleaseStage = (html: string, stage: ReleaseStage): string =>
  html.replace(htmlTagPattern, `<html$1 data-theoria-release-stage="${stage}">`)

const titlePattern = /<title>[^<]*<\/title>/u
const metaPattern = (nameOrProperty: string): RegExp =>
  new RegExp(`<meta\\s+(name|property)="${nameOrProperty}"\\s+content="[^"]*"\\s*/?>`, "u")
const canonicalPattern = /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/u

const injectMetadata = (html: string, location: PageLocation): string => {
  const metadata = PagePresentation.fromLocation(location).metadata
  const canonicalUrl = SiteMetadata.fullCanonicalUrl(metadata.canonicalPath)

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

export const staticResponse = (_pathname: string, rawUrl: string) =>
  Effect.gen(function*() {
    const location = PageLocation.fromUrl(rawUrl)
    const releaseStage = yield* serverReleaseStage
    const redirectPath = packageDocsRedirectPath(location, releaseStage)

    if (redirectPath !== null) {
      return HttpServerResponse.redirect(redirectPath, {
        status: 302,
        headers: {
          "cache-control": "no-store"
        }
      })
    }

    const fileSystem = yield* FileSystem.FileSystem
    const resolvedPath = staticAssetPath(location, releaseStage)

    return yield* Option.match(resolvedPath, {
      onNone: () => Effect.succeed(notFoundResponse()),
      onSome: (path) =>
        fileSystem.exists(path).pipe(
          Effect.catchAll(() => Effect.succeed(false)),
          Effect.flatMap((exists) =>
            Match.value(exists).pipe(
              Match.when(true, () =>
                isHtmlPath(location, releaseStage)
                  ? fileSystem.readFileString(path).pipe(
                    Effect.map((html) => injectMetadata(injectReleaseStage(html, releaseStage), location)),
                    Effect.flatMap((html) =>
                      HttpServerResponse.text(html, {
                        status: 200,
                        headers: responseHeaders(headerPath(location, releaseStage))
                      })
                    ),
                    Effect.catchAll(() => Effect.succeed(notFoundResponse()))
                  )
                  : HttpServerResponse.file(path, {
                    headers: responseHeaders(headerPath(location, releaseStage))
                  }).pipe(Effect.catchAll(() => Effect.succeed(notFoundResponse())))),
              Match.orElse(() => Effect.succeed(notFoundResponse()))
            )
          )
        )
    })
  })
