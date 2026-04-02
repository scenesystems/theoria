import { describe, expect, it } from "@effect/vitest"
import { Effect, Either } from "effect"

import {
  type ChoreographyState,
  Idle,
  initialChoreographyState,
  InStage,
  reduceChoreographyState
} from "../../app/contracts/choreography.js"
import {
  Choreography,
  decodeEvidenceEventJson,
  encodeEvidenceEventJson,
  Highlight,
  StageAdvance,
  StageEnter,
  StageExit
} from "../../app/contracts/evidence-stream.js"

describe("Choreography Contract", () => {
  describe("ChoreographyState", () => {
    it("Idle has correct tag", () => {
      expect(Idle()._tag).toBe("Idle")
    })

    it("InStage carries stageId, step, and params", () => {
      const state = InStage({ stageId: "x", step: 1, params: { d: 0.5 } })
      expect(state._tag).toBe("InStage")
      expect(state.stageId).toBe("x")
      expect(state.step).toBe(1)
      expect(state.params).toEqual({ d: 0.5 })
    })

    it("initialChoreographyState is Idle", () => {
      expect(initialChoreographyState._tag).toBe("Idle")
    })
  })

  describe("reduceChoreographyState", () => {
    const idle: ChoreographyState = initialChoreographyState

    it("StageEnter transitions Idle to InStage", () => {
      const next = reduceChoreographyState(
        idle,
        new StageEnter({ stageId: "corpus-sweep", params: { corpusIndex: 0 } })
      )
      expect(next._tag).toBe("InStage")
      if (next._tag === "InStage") {
        expect(next.stageId).toBe("corpus-sweep")
        expect(next.step).toBe(0)
        expect(next.params).toEqual({ corpusIndex: 0 })
      }
    })

    it("StageEnter with no params defaults to empty object", () => {
      const next = reduceChoreographyState(
        idle,
        new StageEnter({ stageId: "test-stage" })
      )
      expect(next._tag).toBe("InStage")
      if (next._tag === "InStage") {
        expect(next.params).toEqual({})
      }
    })

    it("StageAdvance updates step and merges params within matching stage", () => {
      const inStage = InStage({ stageId: "sweep", step: 0, params: { d: 0.2 } })
      const next = reduceChoreographyState(
        inStage,
        new StageAdvance({ stageId: "sweep", step: 3, params: { n: 30 } })
      )
      expect(next._tag).toBe("InStage")
      if (next._tag === "InStage") {
        expect(next.step).toBe(3)
        expect(next.params).toEqual({ d: 0.2, n: 30 })
      }
    })

    it("StageAdvance is ignored when stageId does not match", () => {
      const inStage = InStage({ stageId: "sweep", step: 0, params: {} })
      const next = reduceChoreographyState(
        inStage,
        new StageAdvance({ stageId: "other", step: 1 })
      )
      expect(next._tag).toBe("InStage")
      if (next._tag === "InStage") {
        expect(next.stageId).toBe("sweep")
        expect(next.step).toBe(0)
      }
    })

    it("StageAdvance is ignored when state is Idle", () => {
      const next = reduceChoreographyState(
        idle,
        new StageAdvance({ stageId: "sweep", step: 1 })
      )
      expect(next._tag).toBe("Idle")
    })

    it("StageExit transitions InStage to Idle when stageId matches", () => {
      const inStage = InStage({ stageId: "sweep", step: 5, params: { d: 1.0 } })
      const next = reduceChoreographyState(
        inStage,
        new StageExit({ stageId: "sweep" })
      )
      expect(next._tag).toBe("Idle")
    })

    it("StageExit is ignored when stageId does not match", () => {
      const inStage = InStage({ stageId: "sweep", step: 5, params: {} })
      const next = reduceChoreographyState(
        inStage,
        new StageExit({ stageId: "other" })
      )
      expect(next._tag).toBe("InStage")
    })

    it("Highlight does not change state", () => {
      const inStage = InStage({ stageId: "sweep", step: 2, params: {} })
      const next = reduceChoreographyState(
        inStage,
        new Highlight({ target: "tpe-best", params: { trialIndex: 12 } })
      )
      expect(next._tag).toBe("InStage")
      if (next._tag === "InStage") {
        expect(next.step).toBe(2)
      }
    })

    it("full stage lifecycle: enter → advance → advance → exit", () => {
      const s0 = reduceChoreographyState(
        idle,
        new StageEnter({ stageId: "corpus-sweep", params: { corpusIndex: 0 } })
      )
      expect(s0._tag).toBe("InStage")

      const s1 = reduceChoreographyState(
        s0,
        new StageAdvance({ stageId: "corpus-sweep", step: 1, params: { width: 280 } })
      )
      if (s1._tag === "InStage") {
        expect(s1.step).toBe(1)
        expect(s1.params).toEqual({ corpusIndex: 0, width: 280 })
      }

      const s2 = reduceChoreographyState(
        s1,
        new StageAdvance({ stageId: "corpus-sweep", step: 2, params: { width: 480 } })
      )
      if (s2._tag === "InStage") {
        expect(s2.step).toBe(2)
        expect(s2.params).toEqual({ corpusIndex: 0, width: 480 })
      }

      const s3 = reduceChoreographyState(s2, new StageExit({ stageId: "corpus-sweep" }))
      expect(s3._tag).toBe("Idle")
    })
  })

  describe("cue schema round-trip", () => {
    it.effect("StageEnter serializes and deserializes via EvidenceEvent", () =>
      Effect.gen(function*() {
        const event = new Choreography({
          cue: new StageEnter({ stageId: "effect-size", params: { d: 0.5 } })
        })
        const json = encodeEvidenceEventJson(event)
        const result = decodeEvidenceEventJson(json)
        expect(Either.isRight(result)).toBe(true)
        if (Either.isRight(result)) {
          expect(result.right._tag).toBe("Choreography")
        }
      }))

    it.effect("StageAdvance round-trips through JSON encoding", () =>
      Effect.gen(function*() {
        const event = new Choreography({
          cue: new StageAdvance({ stageId: "sweep", step: 7, params: { n: 50 } })
        })
        const json = encodeEvidenceEventJson(event)
        const result = decodeEvidenceEventJson(json)
        expect(Either.isRight(result)).toBe(true)
        if (Either.isRight(result)) {
          expect(result.right._tag).toBe("Choreography")
          if (result.right._tag === "Choreography") {
            expect(result.right.cue._tag).toBe("StageAdvance")
          }
        }
      }))

    it.effect("Highlight round-trips through JSON encoding", () =>
      Effect.gen(function*() {
        const event = new Choreography({
          cue: new Highlight({ target: "tpe-best" })
        })
        const json = encodeEvidenceEventJson(event)
        const result = decodeEvidenceEventJson(json)
        expect(Either.isRight(result)).toBe(true)
        if (Either.isRight(result)) {
          expect(result.right._tag).toBe("Choreography")
          if (result.right._tag === "Choreography") {
            expect(result.right.cue._tag).toBe("Highlight")
          }
        }
      }))
  })
})
