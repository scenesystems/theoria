import { HttpServerRequest } from "@effect/platform"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { siteMetadata } from "../../app/contracts/metadata.js"
import { requestIsCanonical } from "../../app/server/canonical-host.js"
import { serverRequest } from "./platform/web-request.js"

const isCanonical = (url: string, headers: Record<string, string> = {}) =>
  Effect.provideService(requestIsCanonical, HttpServerRequest.HttpServerRequest, serverRequest(url, { headers }))

describe("the canonical hostname", () => {
  it.effect("is the one the request's URL names", () =>
    Effect.gen(function*() {
      expect(yield* isCanonical(`${siteMetadata.siteUrl}/docs`)).toBe(true)
      expect(yield* isCanonical("https://theoria.staging.scenesystems.io/docs")).toBe(false)
      expect(yield* isCanonical("https://theoria-pr-7.staging.scenesystems.io/")).toBe(false)
      expect(yield* isCanonical("http://127.0.0.1:8787/")).toBe(false)
    }))

  it.effect("does not read the Host header, which a local runtime sets to its own listening address", () =>
    Effect.gen(function*() {
      expect(yield* isCanonical(`${siteMetadata.siteUrl}/`, { host: "127.0.0.1:8787" })).toBe(true)
      expect(yield* isCanonical("http://127.0.0.1:8787/", { host: "theoria.scenesystems.io" })).toBe(false)
    }))
})
