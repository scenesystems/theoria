import { Atom, Result } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Match, Schema, Stream } from "effect"

import * as BrowserWindow from "../platform/BrowserWindow.js"
import { appRuntime } from "./runtime.js"

/** Whether things on the page may travel: `full`, or `reduced` when the reader's system asks for less motion. */
export const MotionPreference = Schema.Literal("full", "reduced")

export type MotionPreference = typeof MotionPreference.Type

const systemMotionPreferenceAtom: AtomType.Atom<Result.Result<MotionPreference>> = appRuntime.atom(
  BrowserWindow.mediaQuery("(prefers-reduced-motion: reduce)").pipe(
    Stream.map((reduce): MotionPreference => reduce ? "reduced" : "full")
  )
)

/**
 * The reader's motion preference, followed live from the system. This is the
 * one place the page reads it: Motion is configured from it at the root, and
 * CSS reads the same media query for its own transitions.
 */
export const motionPreferenceAtom: AtomType.Atom<MotionPreference> = Atom.make((get) =>
  Result.getOrElse(get(systemMotionPreferenceAtom), (): MotionPreference => "full")
)

/** Motion's own vocabulary for the preference; it is told, never left to read the window itself. */
export type MotionConfigReducedMotion = "always" | "never"

/** How Motion should treat the preference: reduced motion skips transforms and layout, keeping opacity. */
export const motionConfigReducedMotion = (preference: MotionPreference): MotionConfigReducedMotion =>
  Match.value(preference).pipe(
    Match.when("reduced", (): MotionConfigReducedMotion => "always"),
    Match.when("full", (): MotionConfigReducedMotion => "never"),
    Match.exhaustive
  )
