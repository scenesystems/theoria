import { Match } from "effect"

import {
  type PlaceComposition,
  type PlaceScenario,
  placeScenarioMeta,
  type ProposedFeature
} from "../../contracts/imagined-place.js"

/**
 * One recorded scenario.
 *
 * `label` and `brief` come from `placeScenarioMeta` in the contracts, which is
 * what the browser shows before anything is built.
 *
 * `recorded` is what the composer program returned for `brief` when the demo
 * was authored, and `programProposal` is what the proposer program returned
 * when shown that composition. Both are replayed through the real
 * `effect-dsp` programs at run time, so the outputs are still schema-checked,
 * but no provider is contacted. The UI labels this "Recorded inference".
 *
 * `neighbor` is a second person's proposal and the note they sealed to the
 * author. Neither is model output.
 */
export type PlaceScenarioDefinition = {
  readonly id: PlaceScenario
  readonly label: string
  readonly brief: string
  readonly recorded: PlaceComposition
  readonly neighbor: {
    readonly name: string
    readonly proposal: ProposedFeature
    readonly note: string
  }
  readonly programProposal: ProposedFeature
}

const listeningGarden: PlaceScenarioDefinition = {
  id: "listening-garden",
  ...placeScenarioMeta["listening-garden"],
  recorded: {
    title: "The Listening Garden",
    summary: "A night garden shaped for telling, listening, and returning at your own pace.",
    atmosphere: "Low lanterns hang in the canopy; gravel paths bend around a still pool that holds the moon.",
    features: [
      {
        name: "Story canopy",
        description: "A ring of benches under broad leaves where stories are read aloud.",
        weight: 0.9
      },
      {
        name: "Exchange shelf",
        description: "A weatherproof shelf where one-page stories are left and taken.",
        weight: 0.6
      },
      {
        name: "Listening pool",
        description: "Still water that gives a pause without ending the exchange.",
        weight: 0.7
      },
      { name: "Quiet path", description: "A dim, unhurried route that leads anyone back to the gate.", weight: 0.4 }
    ]
  },
  neighbor: {
    name: "a neighbor who visited on the first night",
    proposal: {
      name: "Open seat",
      description: "One place at the canopy left deliberately empty for whoever arrives next.",
      weight: 0.5,
      rationale: "Every story I heard was better because someone unexpected was listening."
    },
    note: "I left a story on the shelf for you. It is about the gate, and it is not finished."
  },
  programProposal: {
    name: "Lantern keeper's stool",
    description: "A low stool by the first lantern where the evening's host trims the wicks.",
    weight: 0.35,
    rationale: "The composition names lanterns and hosts but gives neither a place to begin the night."
  }
}

const tidalWorkshop: PlaceScenarioDefinition = {
  id: "tidal-workshop",
  ...placeScenarioMeta["tidal-workshop"],
  recorded: {
    title: "The Tidal Workshop",
    summary: "A working harbor where half-built things are welcome and leave with more hands on them.",
    atmosphere: "Warm windows face the water; floating decks join and drift apart with the tide.",
    features: [
      { name: "Arrival deck", description: "Where new work lands without needing to look finished.", weight: 0.8 },
      {
        name: "Tide table",
        description: "A shared board that makes changing conditions legible to everyone.",
        weight: 0.5
      },
      { name: "Tool library", description: "Reusable instruments kept within reach of the work.", weight: 0.7 },
      {
        name: "Signal mast",
        description: "A visible flag that asks for the kind of help a project needs.",
        weight: 0.4
      }
    ]
  },
  neighbor: {
    name: "the crew that used the workshop last season",
    proposal: {
      name: "Repair bench",
      description: "A bench stocked with materials the previous crew left behind.",
      weight: 0.6,
      rationale: "We left more than we took; the next crew should find it without asking."
    },
    note: "The third deck lists to port at low tide. We never fixed it. Maybe you will."
  },
  programProposal: {
    name: "Departure log",
    description: "A ledger by the last deck where each idea records who touched it before it sails.",
    weight: 0.45,
    rationale: "The brief promises ideas leave stronger, but nothing in the composition records how."
  }
}

const storyCommons: PlaceScenarioDefinition = {
  id: "story-commons",
  ...placeScenarioMeta["story-commons"],
  recorded: {
    title: "The Story Commons",
    summary: "A room where accounts can meet, stay distinct, and be returned to later.",
    atmosphere: "Shelves curve around an open floor; wide thresholds admit many ways of arriving.",
    features: [
      { name: "Open floor", description: "Space where arrangements can form without fixing a center.", weight: 0.9 },
      {
        name: "Memory shelves",
        description: "Accounts kept distinct, labeled, and available for return.",
        weight: 0.7
      },
      { name: "Question wall", description: "Unresolved questions that stay visible between gatherings.", weight: 0.6 },
      {
        name: "Shared threshold",
        description: "An entrance that makes different ways of entering explicit.",
        weight: 0.5
      }
    ]
  },
  neighbor: {
    name: "a first-time visitor",
    proposal: {
      name: "Listening alcove",
      description: "A small recess for hearing one account all the way through.",
      weight: 0.5,
      rationale: "I wanted to finish one account before the room offered me another."
    },
    note: "My account of that day is on the second shelf. Please leave it next to the others, not above them."
  },
  programProposal: {
    name: "Return desk",
    description: "A desk where an account taken down is logged back onto its shelf with the date.",
    weight: 0.4,
    rationale: "The summary says accounts can be returned to later, but the room has no way to know what left."
  }
}

export const placeScenarioDefinitions: ReadonlyArray<PlaceScenarioDefinition> = [
  listeningGarden,
  tidalWorkshop,
  storyCommons
]

export const scenarioById = (id: PlaceScenario): PlaceScenarioDefinition =>
  Match.value(id).pipe(
    Match.when("listening-garden", () => listeningGarden),
    Match.when("tidal-workshop", () => tidalWorkshop),
    Match.when("story-commons", () => storyCommons),
    Match.exhaustive
  )
