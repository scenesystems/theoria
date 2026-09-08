import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import * as Arr from "effect/Array"

import { ErrorCode, httpStatus } from "../../app/contracts/error.js"

/**
 * One authority for the status an error code is answered with. Every member
 * of the closed set has a status of its own, so a code added to the schema
 * must be given one here (the match is exhaustive) rather than falling to a
 * catch-all that would call a missing route a server fault.
 */
describe("Error contract", () => {
  it.effect("answers each error code with its own status", () =>
    Effect.sync(() => {
      expect(httpStatus("invalid-request")).toBe(400)
      expect(httpStatus("cross-site-request")).toBe(403)
      expect(httpStatus("route-not-found")).toBe(404)
      expect(httpStatus("method-not-allowed")).toBe(405)
      expect(httpStatus("rate-limited")).toBe(429)
      expect(httpStatus("execution-failed")).toBe(500)
    }))

  it.effect("every code the schema admits is an error status, and the client faults are told from the server's", () =>
    Effect.sync(() => {
      Arr.forEach(ErrorCode.literals, (code) => {
        const status = httpStatus(code)
        expect(status, code).toBeGreaterThanOrEqual(400)
        expect(status, code).toBeLessThan(600)
        // Only a failed execution is the server's own fault; every other code names something about the request.
        expect(status >= 500, code).toBe(code === "execution-failed")
      })
    }))
})
