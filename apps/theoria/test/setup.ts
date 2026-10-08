import { afterAll, afterEach, expect, vi } from "vitest"

// A transport error can be captured in an atom without failing its test.
// Assert the attempted call too, so catching that error cannot hide live IO.
const unexpectedFetch = vi.fn(() => expect.unreachable("Unit tests must provide an in-memory HTTP client"))
vi.stubGlobal("fetch", unexpectedFetch)
afterEach(() => expect(unexpectedFetch).not.toHaveBeenCalled())
afterAll(() => expect(unexpectedFetch).not.toHaveBeenCalled())
