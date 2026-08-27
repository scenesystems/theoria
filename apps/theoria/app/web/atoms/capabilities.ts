import type { Atom } from "@effect-atom/atom"
import type { Result } from "@effect-atom/atom"
import { Effect } from "effect"

import type { Capabilities } from "../../contracts/capabilities.js"
import type { DemoError } from "../../contracts/demo-error.js"
import { DemoClient } from "../services/DemoClient.js"

import { appRuntime } from "./runtime.js"

export const capabilitiesAtom: Atom.Atom<Result.Result<Capabilities, DemoError>> = appRuntime.atom(
  Effect.gen(function*() {
    const client = yield* DemoClient
    return yield* client.capabilities()
  })
)
