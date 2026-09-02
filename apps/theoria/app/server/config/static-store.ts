import type { HttpServerResponse } from "@effect/platform"
import { Context, type Effect, Match, type Option, Schema } from "effect"

/**
 * Read access to the built web bundle (`apps/theoria/dist`).
 *
 * Every deployment target provides one implementation:
 * the Bun server reads `dist/` from disk, the Cloudflare Worker reads the
 * uploaded static assets through the `ASSETS` binding. Server code never
 * touches a filesystem directly; it asks the store for an asset by its
 * absolute URL pathname (`/index.html`, `/docs-data/manifest.json`).
 */
export class StaticStoreError extends Schema.TaggedError<StaticStoreError>()("StaticStoreError", {
  pathname: Schema.String,
  message: Schema.String
}) {}

export class StaticStore extends Context.Tag("@theoria/app/server/config/StaticStore")<
  StaticStore,
  {
    /** Read an asset as UTF-8 text. Fails when the asset does not exist. */
    readonly text: (pathname: string) => Effect.Effect<string, StaticStoreError>
    /**
     * Stream an asset as an HTTP response carrying `content-type` (and
     * `content-encoding` when the store serves a precompressed variant).
     * Resolves to `None` when the asset does not exist.
     */
    readonly response: (
      pathname: string,
      acceptEncoding: Option.Option<string>
    ) => Effect.Effect<Option.Option<HttpServerResponse.HttpServerResponse>>
  }
>() {}

/** Assets under this prefix feed the server at runtime and are never served to browsers. */
export const runtimeDataPrefix = "/runtime-data/"

export const contentTypeForPath = (pathname: string): string =>
  Match.value(pathname).pipe(
    Match.when((value) => value.endsWith(".html"), () => "text/html; charset=utf-8"),
    Match.when((value) => value.endsWith(".css"), () => "text/css; charset=utf-8"),
    Match.when((value) => value.endsWith(".js"), () => "application/javascript; charset=utf-8"),
    Match.when((value) => value.endsWith(".json"), () => "application/json; charset=utf-8"),
    Match.when((value) => value.endsWith(".svg"), () => "image/svg+xml"),
    Match.when((value) => value.endsWith(".png"), () => "image/png"),
    Match.when((value) => value.endsWith(".ico"), () => "image/x-icon"),
    Match.when((value) => value.endsWith(".woff2"), () => "font/woff2"),
    Match.when((value) => value.endsWith(".xml"), () => "application/xml; charset=utf-8"),
    Match.when((value) => value.endsWith(".webmanifest"), () => "application/manifest+json"),
    Match.orElse(() => "text/plain; charset=utf-8")
  )
