import { Match, Schema } from "effect"

import {
  PlaceComposition,
  PlaceScenario,
  placeScenarioMeta,
  placeScenarioRecordings,
  ProposedFeature
} from "../../contracts/imagined-place.js"

/**
 * One recorded scenario.
 *
 * `label` and `brief` come from `placeScenarioMeta` in the contracts, which is
 * what the browser shows before anything is built.
 *
 * `recorded` is what the composer program returned for `brief` when the demo
 * was authored, and `programProposal` is what the proposer program returned
 * when shown that composition; both come from `placeScenarioRecordings` in the
 * contracts, which the browser reads for the shape of the place it is about
 * to be sent. Both are replayed through the real `effect-dsp` programs at run
 * time, so the outputs are still schema-checked, but no provider is
 * contacted. The UI labels this "Recorded inference".
 *
 * `neighbor` is a second person's proposal and the note they sealed to the
 * author. Neither is model output. The note is only here: it is for the
 * author, not the page.
 */
export const PlaceScenarioDefinition = Schema.Struct({
  id: PlaceScenario,
  label: Schema.String,
  brief: Schema.String,
  recorded: PlaceComposition,
  neighbor: Schema.Struct({ proposal: ProposedFeature, note: Schema.String }),
  programProposal: ProposedFeature
})
export type PlaceScenarioDefinition = typeof PlaceScenarioDefinition.Type

const unfinishedLight: PlaceScenarioDefinition = {
  id: "unfinished-light",
  ...placeScenarioMeta["unfinished-light"],
  recorded: placeScenarioRecordings["unfinished-light"].composition,
  neighbor: {
    proposal: placeScenarioRecordings["unfinished-light"].neighbor,
    note:
      "The letter in the 1994 hole with the blue string is my father's. It is to my mother, and she is still alive. If you finish it, finish it kindly, and don't tell me what it said."
  },
  programProposal: placeScenarioRecordings["unfinished-light"].program
}

const lostMarket: PlaceScenarioDefinition = {
  id: "lost-market",
  ...placeScenarioMeta["lost-market"],
  recorded: placeScenarioRecordings["lost-market"].composition,
  neighbor: {
    proposal: placeScenarioRecordings["lost-market"].neighbor,
    note:
      "The brass compass on the far table is my father's. He lost it the day I was born and told me the wrong date for forty years. I have worked out which day it was. Don't let anyone else sit for it."
  },
  programProposal: placeScenarioRecordings["lost-market"].program
}

const drownedLibrary: PlaceScenarioDefinition = {
  id: "drowned-library",
  ...placeScenarioMeta["drowned-library"],
  recorded: placeScenarioRecordings["drowned-library"].composition,
  neighbor: {
    proposal: placeScenarioRecordings["drowned-library"].neighbor,
    note:
      "My grandmother's name is on the card in the blue atlas, north wall, second table. She took it out the week before and never brought it back. It is in my kitchen. I want to return it this week, properly, and I want you to stamp it."
  },
  programProposal: placeScenarioRecordings["drowned-library"].program
}

export const placeScenarioDefinitions: ReadonlyArray<PlaceScenarioDefinition> = [
  unfinishedLight,
  lostMarket,
  drownedLibrary
]

export const scenarioById = (id: PlaceScenario): PlaceScenarioDefinition =>
  Match.value(id).pipe(
    Match.when("unfinished-light", () => unfinishedLight),
    Match.when("lost-market", () => lostMarket),
    Match.when("drowned-library", () => drownedLibrary),
    Match.exhaustive
  )
