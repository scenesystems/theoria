import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"

import type { WordmarkEvent, WordmarkPhase } from "../view/primitives/wordmarkMorph.js"
import { wordmarkPhaseAfter } from "../view/primitives/wordmarkMorph.js"

const phaseState = Atom.make<WordmarkPhase>("intro").pipe(Atom.keepAlive)

/**
 * Where the wordmark is in its motion, read as a phase and written as events.
 * It is kept for the session, not the mount: the header's wordmark plays its
 * intro once, rests, and plays again only when a reader meets it. Writing
 * `replayAsked` to a running pass leaves that pass to finish.
 */
export const wordmarkPhaseAtom: AtomType.Writable<WordmarkPhase, WordmarkEvent> = Atom.writable(
  (get: AtomType.Context) => get(phaseState),
  (ctx: AtomType.WriteContext<WordmarkPhase>, event: WordmarkEvent) => {
    ctx.set(phaseState, wordmarkPhaseAfter(ctx.get(phaseState), event))
  }
).pipe(Atom.keepAlive)
