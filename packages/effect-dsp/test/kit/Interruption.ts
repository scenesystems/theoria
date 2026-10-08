import { expect } from "@effect/vitest"
import type { ComposableModule } from "@scenesystems/effect-dsp/Module"
import * as ParameterSet from "@scenesystems/effect-dsp/ParameterSet"
import { Array as Arr, Cause, Effect, Exit, Predicate, Schema } from "effect"

const encodeParameterSet = Schema.encodeEffect(Schema.fromJsonString(ParameterSet.ParameterSet))

/**
 * Requires interruption to be the only exit reason. Cleanup assertions and finalizer
 * defects surface as Die reasons beside the Interrupt, so `hasInterrupts` alone hides them.
 */
export const expectInterruptedOnly = <A, E>(exit: Exit.Exit<A, E>) =>
  Exit.match(exit, {
    onSuccess: () => expect.fail("expected an interrupted exit, observed success"),
    onFailure: (cause) => {
      expect(Arr.filter(cause.reasons, Predicate.not(Cause.isInterruptReason))).toEqual([])
      expect(Cause.hasInterruptsOnly(cause)).toBe(true)
    }
  })

/** Encoded caller parameters, read by the test fiber rather than the interrupted fiber. */
export const encodedSnapshot = (module: ComposableModule) =>
  ParameterSet.snapshot(module).pipe(Effect.flatMap(encodeParameterSet))
