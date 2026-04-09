/**
 * Contract for migrated `pi` session entry decoding across versions 1, 2, and 3.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"
import * as Experimental from "effect-dsp/experimental"

import {
  piSessionV1Fixture,
  piSessionV2Fixture,
  piSessionV3Fixture
} from "../fixtures/open-agent-trace/pi-mono/fixtures.js"

describe("OpenAgentTrace/piSessionEntry", () => {
  it.effect("migrates versions 1, 2, and 3 through one canonical entry family that accepts the required entry kinds", () =>
    Effect.gen(function*() {
      const v1 = yield* Experimental.OpenAgentTrace.PiMono.migrateSessionEntries(piSessionV1Fixture)
      const v2 = yield* Experimental.OpenAgentTrace.PiMono.migrateSessionEntries(piSessionV2Fixture)
      const v3 = yield* Experimental.OpenAgentTrace.PiMono.migrateSessionEntries(piSessionV3Fixture)
      const entryKinds = [...v1.entries, ...v2.entries, ...v3.entries].map((entry) => entry.type)
      const firstV2Message = Option.fromNullable(
        v2.entries.find((entry: (typeof v2.entries)[number]) => entry.type === "message")
      )

      expect(v1.header.version).toBe(3)
      expect(v2.header.version).toBe(3)
      expect(v3.header.version).toBe(3)
      expect(entryKinds).toEqual(
        expect.arrayContaining([
          "message",
          "model_change",
          "thinking_level_change",
          "compaction",
          "branch_summary",
          "custom",
          "custom_message",
          "label",
          "session_info"
        ])
      )
      expect(Option.isSome(firstV2Message)).toBe(true)
      Option.match(firstV2Message, {
        onNone: () => undefined,
        onSome: (entry) => expect(entry.message.role).toBe("custom")
      })
      expect(v1.entries[0]?.id).toBe("legacy-0001")
      expect(v1.entries[1]?.parentId).toBe("legacy-0001")
    }))
})
