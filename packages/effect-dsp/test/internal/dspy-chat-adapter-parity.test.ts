import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"

import {
  ChatOutputRequirementsFixtureSchema,
  ChatPromptFixtureSchema,
  ChatQaOutputRequirementsFixtureSchema,
  ChatSystemMessageFixtureSchema,
  makeFixtureRegistry
} from "../helpers/dspy-fixtures/index.js"

describe("internal/chat-adapter DSPy fixture parity", () => {
  it.effect("asserts full fixture payload equality for messages, output requirements, and field metadata", () =>
    Effect.gen(function*() {
      const registry = makeFixtureRegistry()
      const rawBasic = yield* registry.load("dspy.chat.qa-basic")
      const rawWithDemo = yield* registry.load("dspy.chat.qa-with-demo")
      const rawOutputRequirements = yield* registry.load("dspy.chat.output-requirements.basic")
      const rawQaOutputRequirements = yield* registry.load("dspy.chat.qa-output-requirements")
      const rawSystemMessage = yield* registry.load("dspy.chat.system-message.basic")

      const basic = yield* Schema.decodeUnknown(ChatPromptFixtureSchema)(rawBasic)
      const withDemo = yield* Schema.decodeUnknown(ChatPromptFixtureSchema)(rawWithDemo)
      const outputRequirements = yield* Schema.decodeUnknown(ChatOutputRequirementsFixtureSchema)(
        rawOutputRequirements
      )
      const qaOutputRequirements = yield* Schema.decodeUnknown(ChatQaOutputRequirementsFixtureSchema)(
        rawQaOutputRequirements
      )
      const systemMessage = yield* Schema.decodeUnknown(ChatSystemMessageFixtureSchema)(rawSystemMessage)

      expect(qaOutputRequirements.payload.signatureDescription).toBe(basic.payload.signatureDescription)
      expect(qaOutputRequirements.payload.inputFields).toStrictEqual(basic.payload.inputFields)
      expect(qaOutputRequirements.payload.outputFields).toStrictEqual(basic.payload.outputFields)
      expect(qaOutputRequirements.payload.fieldMarkers).toStrictEqual(basic.payload.fieldMarkers)
      expect(qaOutputRequirements.payload.fieldMarkers).toStrictEqual(withDemo.payload.fieldMarkers)

      expect(qaOutputRequirements.payload.basic.query).toBe(basic.payload.query)
      expect(qaOutputRequirements.payload.basic.messages).toStrictEqual(basic.payload.messages)
      expect(qaOutputRequirements.payload.basic.outputRequirements).toBe(basic.payload.outputRequirements)

      expect(qaOutputRequirements.payload.withDemo.query).toBe(withDemo.payload.query)
      expect(qaOutputRequirements.payload.withDemo.demo).toStrictEqual(withDemo.payload.demo)
      expect(qaOutputRequirements.payload.withDemo.messages).toStrictEqual(withDemo.payload.messages)
      expect(qaOutputRequirements.payload.withDemo.outputRequirements).toBe(withDemo.payload.outputRequirements)

      expect(systemMessage.payload.systemMessage).toBe(basic.payload.messages[0]?.content)
      expect(outputRequirements.payload.finalUserMessage).toBe(basic.payload.messages[1]?.content)
      expect(outputRequirements.payload.outputRequirements).toBe(qaOutputRequirements.payload.basic.outputRequirements)
      expect(outputRequirements.payload.outputRequirements).toBe(
        qaOutputRequirements.payload.withDemo.outputRequirements
      )
      expect(qaOutputRequirements.payload.withDemo.messages[3]?.content).toBe(
        outputRequirements.payload.finalUserMessage
      )
    }))
})
