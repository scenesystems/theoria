import type { HttpServerResponse } from "@effect/platform"
import { Context, type Effect, HashMap, Option, Schema } from "effect"
import * as Arr from "effect/Array"

/**
 * Read access to the built web bundle (`apps/theoria/dist`).
 *
 * Every deployment target provides one implementation:
 * the Bun server reads `dist/` from disk, the Cloudflare Worker reads the
 * uploaded static assets through the `ASSETS` binding. Server code never
 * touches a filesystem directly; it asks the store for an asset by its
 * absolute URL pathname (`/index.html`, `/docs-data/manifest.json`).
 */
/**
 * Why an asset read failed. `NotFound` and `InvalidPathname` describe the
 * request; `Unreadable` describes the store: the asset should be servable but
 * the filesystem or assets binding could not deliver it, which is a server
 * fault and never a 404.
 */
export const StaticStoreFailureReason = Schema.Literal("NotFound", "InvalidPathname", "Unreadable")

export class StaticStoreError extends Schema.TaggedError<StaticStoreError>()("StaticStoreError", {
  pathname: Schema.String,
  reason: StaticStoreFailureReason,
  /** Diagnostic from the platform or transport; empty for request-side reasons. */
  detail: Schema.String
}) {}

export class StaticStore extends Context.Tag("@theoria/app/server/config/StaticStore")<
  StaticStore,
  {
    /** Read an asset as UTF-8 text. Fails when the asset does not exist or cannot be read. */
    readonly text: (pathname: string) => Effect.Effect<string, StaticStoreError>
    /**
     * Stream an asset as an HTTP response carrying `content-type`.
     * Resolves to `None` when there is no such servable asset; fails with
     * reason `Unreadable` when the asset exists but the store cannot deliver it.
     */
    readonly response: (
      pathname: string
    ) => Effect.Effect<Option.Option<HttpServerResponse.HttpServerResponse>, StaticStoreError>
  }
>() {}

export const htmlContentType = "text/html; charset=utf-8"
export const textContentType = "text/plain; charset=utf-8"

/**
 * Exactly the file types the built site ships. This table is the single
 * source of truth shared by the Bun server (response `content-type`) and the
 * build gate (`checkBuildOutput`): a `dist/` file whose extension is missing
 * here fails the build before upload, so add the type here when a new kind of
 * asset starts shipping. Generated responses (`/sitemap.xml`) carry their own
 * type and never pass through the store.
 */
const contentTypes = HashMap.make(
  [".html", htmlContentType],
  [".txt", textContentType],
  [".css", "text/css; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".webmanifest", "application/manifest+json"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".ico", "image/x-icon"]
)

const extensionOf = (pathname: string): Option.Option<string> =>
  Option.flatMap(Arr.last(pathname.split("/")), (name) => {
    const dot = name.lastIndexOf(".")
    return dot > 0 ? Option.some(name.slice(dot)) : Option.none()
  })

/** `content-type` for a served pathname; `None` when the file type is not one the site serves. */
export const contentTypeForPath = (pathname: string): Option.Option<string> =>
  Option.flatMap(extensionOf(pathname), (extension) => HashMap.get(contentTypes, extension))
