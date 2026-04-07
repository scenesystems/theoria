import type { Atom as AtomType, Result } from "@effect-atom/atom"
import { Atom } from "@effect-atom/atom"
import { Effect } from "effect"

import type { OpenAgentTraceError, OpenAgentTraceRegistryEntry } from "../../contracts/open-agent-trace.js"
import { OpenAgentTraceClient } from "../services/OpenAgentTraceClient.js"

const openAgentTraceRuntime = Atom.runtime(OpenAgentTraceClient.Default)

export const openAgentTraceRegistryAtom: AtomType.Atom<
  Result.Result<ReadonlyArray<OpenAgentTraceRegistryEntry>, OpenAgentTraceError>
> = openAgentTraceRuntime.atom(
  Effect.gen(function*() {
    const client = yield* OpenAgentTraceClient
    return yield* client.registry()
  })
)
