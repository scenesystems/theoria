/**
 * Raw `pi` session migration helpers.
 *
 * @since 0.2.0
 */
import { Effect, Schema } from "effect"
import { PiSessionEntry, type PiSessionEntry as PiSessionEntryType, PiSessionHeader } from "../schema.js"

const RawSessionHeader = Schema.Struct({
  type: Schema.Literal("session"),
  version: Schema.optional(Schema.Number),
  id: Schema.String,
  timestamp: Schema.String,
  cwd: Schema.String,
  parentSession: Schema.optional(Schema.String)
})

const RawEntryBase = Schema.Struct({
  type: Schema.String,
  timestamp: Schema.String,
  id: Schema.optional(Schema.String),
  parentId: Schema.optional(Schema.NullOr(Schema.String))
})

const RawMessage = Schema.Union(
  Schema.Struct({ role: Schema.Literal("user"), content: Schema.Unknown, timestamp: Schema.Number }),
  Schema.Struct({
    role: Schema.Literal("assistant"),
    content: Schema.Array(Schema.Unknown),
    api: Schema.String,
    provider: Schema.String,
    model: Schema.String,
    usage: Schema.Struct({
      input: Schema.Number,
      output: Schema.Number,
      cacheRead: Schema.Number,
      cacheWrite: Schema.Number,
      totalTokens: Schema.Number,
      cost: Schema.Struct({
        input: Schema.Number,
        output: Schema.Number,
        cacheRead: Schema.Number,
        cacheWrite: Schema.Number,
        total: Schema.Number
      })
    }),
    stopReason: Schema.String,
    errorMessage: Schema.optional(Schema.String),
    timestamp: Schema.Number
  }),
  Schema.Struct({
    role: Schema.Literal("toolResult"),
    toolCallId: Schema.String,
    toolName: Schema.String,
    content: Schema.Array(Schema.Unknown),
    details: Schema.optional(Schema.Unknown),
    isError: Schema.Boolean,
    timestamp: Schema.Number
  }),
  Schema.Struct({
    role: Schema.Literal("bashExecution"),
    command: Schema.String,
    output: Schema.String,
    exitCode: Schema.optional(Schema.NullOr(Schema.Number)),
    cancelled: Schema.Boolean,
    truncated: Schema.Boolean,
    fullOutputPath: Schema.optional(Schema.String),
    excludeFromContext: Schema.optional(Schema.Boolean),
    timestamp: Schema.Number
  }),
  Schema.Struct({
    role: Schema.Literal("custom", "hookMessage"),
    customType: Schema.String,
    content: Schema.Unknown,
    display: Schema.Boolean,
    details: Schema.optional(Schema.Unknown),
    timestamp: Schema.Number
  })
)

const RawEntry = Schema.Union(
  RawEntryBase.pipe(Schema.extend(Schema.Struct({ type: Schema.Literal("message"), message: RawMessage }))),
  RawEntryBase.pipe(
    Schema.extend(
      Schema.Struct({ type: Schema.Literal("model_change"), provider: Schema.String, modelId: Schema.String })
    )
  ),
  RawEntryBase.pipe(
    Schema.extend(Schema.Struct({ type: Schema.Literal("thinking_level_change"), thinkingLevel: Schema.String }))
  ),
  RawEntryBase.pipe(
    Schema.extend(
      Schema.Struct({
        type: Schema.Literal("compaction"),
        summary: Schema.String,
        firstKeptEntryId: Schema.optional(Schema.String),
        firstKeptEntryIndex: Schema.optional(Schema.Number),
        tokensBefore: Schema.Number,
        details: Schema.optional(Schema.Unknown),
        fromHook: Schema.optional(Schema.Boolean)
      })
    )
  ),
  RawEntryBase.pipe(
    Schema.extend(
      Schema.Struct({
        type: Schema.Literal("branch_summary"),
        fromId: Schema.String,
        summary: Schema.String,
        details: Schema.optional(Schema.Unknown),
        fromHook: Schema.optional(Schema.Boolean)
      })
    )
  ),
  RawEntryBase.pipe(
    Schema.extend(
      Schema.Struct({
        type: Schema.Literal("custom"),
        customType: Schema.String,
        data: Schema.optional(Schema.Unknown)
      })
    )
  ),
  RawEntryBase.pipe(
    Schema.extend(
      Schema.Struct({
        type: Schema.Literal("custom_message"),
        customType: Schema.String,
        content: Schema.Unknown,
        display: Schema.Boolean,
        details: Schema.optional(Schema.Unknown)
      })
    )
  ),
  RawEntryBase.pipe(
    Schema.extend(
      Schema.Struct({ type: Schema.Literal("label"), targetId: Schema.String, label: Schema.optional(Schema.String) })
    )
  ),
  RawEntryBase.pipe(
    Schema.extend(Schema.Struct({ type: Schema.Literal("session_info"), name: Schema.optional(Schema.String) }))
  )
)

const legacyId = (index: number) => `legacy-${String(index + 1).padStart(4, "0")}`

const decodeRawEntry = (entry: unknown) => Schema.decodeUnknown(RawEntry)(entry)

const migrateRole = (message: typeof RawMessage.Type) => {
  if (message.role !== "hookMessage") {
    return message
  }

  return {
    role: "custom",
    customType: message.customType,
    content: message.content,
    display: message.display,
    details: message.details,
    timestamp: message.timestamp
  }
}

const legacyFirstKeptEntryId = (entry: typeof RawEntry.Type) =>
  entry.type !== "compaction"
    ? undefined
    : entry.firstKeptEntryId ?? legacyId(Math.max((entry.firstKeptEntryIndex ?? 1) - 1, 0))

const assignIds = (entries: ReadonlyArray<typeof RawEntry.Type>): ReadonlyArray<unknown> =>
  entries.reduce<Readonly<{ previousId: string | null; entries: ReadonlyArray<unknown> }>>(
    (state, entry, index) => {
      const id = entry.id ?? legacyId(index)
      const parentId = entry.parentId ?? state.previousId
      const migrated = entry.type === "compaction"
        ? {
          ...entry,
          id,
          parentId,
          firstKeptEntryId: legacyFirstKeptEntryId(entry) ?? id
        }
        : entry.type === "message"
        ? { ...entry, id, parentId, message: migrateRole(entry.message) }
        : { ...entry, id, parentId }

      return {
        previousId: id,
        entries: [...state.entries, migrated]
      }
    },
    { previousId: null, entries: [] }
  ).entries

/**
 * Decodes one raw `pi` trace array and migrates it to the canonical v3 entry family.
 *
 * @since 0.2.0
 * @category combinators
 */
export const migratePiSessionEntries = (rawEntries: ReadonlyArray<unknown>) =>
  Effect.gen(function*() {
    const [rawHeader, ...rawBody] = rawEntries
    const header = yield* Schema.decodeUnknown(RawSessionHeader)(rawHeader)
    const body = yield* Effect.forEach(rawBody, decodeRawEntry, { concurrency: 1 })
    const migratedHeader = new PiSessionHeader({ ...header, version: header.version ?? 1 })
    const version = header.version ?? 1
    const migratedBody = assignIds(body)
    const canonicalBody = yield* Effect.forEach(
      migratedBody,
      (entry) => Schema.decodeUnknown(PiSessionEntry)(entry),
      { concurrency: 1 }
    )

    return {
      header: new PiSessionHeader({ ...migratedHeader, version: version < 3 ? 3 : version }),
      entries: canonicalBody
    }
  })

/**
 * Canonical migrated trace payload.
 *
 * @since 0.2.0
 * @category type-level
 */
export type MigratedPiSession = Readonly<{
  readonly header: PiSessionHeader
  readonly entries: ReadonlyArray<PiSessionEntryType>
}>
