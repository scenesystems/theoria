import { Data, Effect, Runtime } from "effect"
import * as EffectRecord from "effect/Record"

import { contentTypeForPath } from "../../app/server/config/static-store.js"
import type { AssetsFetcher } from "../../app/server/platform/assets-static-store.js"

/**
 * In-memory stand-in for the Cloudflare `ASSETS` binding.
 *
 * Mirrors the binding contract the server relies on: only the request pathname
 * matters, found assets carry a `content-type` derived from the extension plus
 * an `etag`, and a miss (with `not_found_handling: "none"`) is a plain 404.
 */
export const fakeAssets = (files: Record<string, string>): AssetsFetcher => ({
  fetch: (request) => {
    const pathname = new URL(request.url).pathname
    return Runtime.runPromise(Runtime.defaultRuntime)(
      EffectRecord.get(files, pathname).pipe(
        Effect.map((body) =>
          new Response(body, {
            status: 200,
            headers: { "content-type": contentTypeForPath(pathname), etag: `"${pathname}"` }
          })
        ),
        Effect.orElseSucceed(() => new Response("Not Found", { status: 404 }))
      )
    )
  }
})

export class AssetsUnavailable extends Data.TaggedError("AssetsUnavailable")<{ readonly reason: string }> {}

/** A binding whose every call rejects, e.g. a misconfigured or unreachable assets service. */
export const failingAssets = (reason: string): AssetsFetcher => ({
  fetch: () => Runtime.runPromise(Runtime.defaultRuntime)(Effect.fail(new AssetsUnavailable({ reason })))
})
