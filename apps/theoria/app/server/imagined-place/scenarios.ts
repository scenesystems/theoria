import { Match, Schema } from "effect"

import { PlaceComposition, PlaceScenario, placeScenarioMeta, ProposedFeature } from "../../contracts/imagined-place.js"

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
 * author. Neither is model output. `name` completes "Neighbor · …" on the card.
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
  recorded: {
    title: "The Unfinished Light",
    summary:
      "The light on Hollin Skerry burns only while someone in the lamp room is writing a letter they cannot finish, and the boats have steered by it for ninety years.",
    atmosphere:
      "The rock is bare but for lichen and the iron stair, and at high water the sea covers the causeway and keeps whoever is at the desk until morning.",
    features: [
      {
        name: "Causeway",
        description:
          "A causeway of set stones runs out from the harbor for two hours either side of low water, and everyone who crosses it carries paper.",
        weight: 0.5
      },
      {
        name: "The desk",
        description:
          "In the lamp room a single desk faces the sea, and the lamp above it brightens with each line and dims when the pen stops.",
        weight: 0.9
      },
      {
        name: "Pigeonholes",
        description:
          "Behind the desk, letters left unfinished wait in pigeonholes by the year they were begun, the oldest gone brown.",
        weight: 0.7
      },
      {
        name: "The rota",
        description:
          "By the door hangs the rota, written in as many hands as the town has, and the blank line at its foot is for tonight.",
        weight: 0.45
      }
    ]
  },
  neighbor: {
    proposal: {
      name: "Finishing shelf",
      description:
        "One shelf by the door holds letters their writers have given up on, and anyone sitting the night may finish one and post it.",
      weight: 0.55,
      rationale:
        "There are letters in those pigeonholes whose writers are dead. Somebody should be allowed to end them."
    },
    note:
      "The letter in the 1994 hole with the blue string is my father's. It is to my mother, and she is still alive. If you finish it, finish it kindly, and don't tell me what it said."
  },
  programProposal: {
    name: "Ship's bell",
    description:
      "A ship's bell hangs on the gallery, and a boat that loses the light may sound its horn three times to wake whoever has stopped writing.",
    weight: 0.4,
    rationale:
      "The lamp dims when the pen stops and the boats depend on it, but nothing says what a boat does when the light goes out."
  }
}

const lostMarket: PlaceScenarioDefinition = {
  id: "lost-market",
  ...placeScenarioMeta["lost-market"],
  recorded: {
    title: "The Market of Lost Things",
    summary:
      "Once a month the market sets up in whatever building the town has most recently emptied, and every stall on its floor sells only what someone has lost.",
    atmosphere:
      "Last month it was the bathhouse; the tiles still sweated, and the stalls were lit by candles set in the drains.",
    features: [
      {
        name: "The ledger",
        description:
          "At the door a woman with a ledger writes your name and one thing you have lost before you may pass.",
        weight: 0.45
      },
      {
        name: "The stalls",
        description:
          "The stalls run by how long a thing has been gone: single gloves near the door, and at the back a table of things lost before anyone living was born.",
        weight: 0.9
      },
      {
        name: "The stool",
        description:
          "To take a thing back you sit on the stool before its stall and tell the day you lost it, and the stallholder knows if you have it wrong.",
        weight: 0.7
      },
      {
        name: "The tin",
        description:
          "Anything not yours costs one thing you found once and never returned, dropped in the tin by the way out.",
        weight: 0.4
      }
    ]
  },
  neighbor: {
    proposal: {
      name: "Second telling",
      description:
        "Anyone who has the day wrong may sit again next month, and the stallholder must keep the thing back until then.",
      weight: 0.5,
      rationale:
        "I have told the day my father lost his compass four times and been wrong four times. I will not be wrong a fifth."
    },
    note:
      "The brass compass on the far table is my father's. He lost it the day I was born and told me the wrong date for forty years. I have worked out which day it was. Don't let anyone else sit for it."
  },
  programProposal: {
    name: "Chalk arrow",
    description:
      "On the door of the building the market has just left, one arrow is chalked, pointing the way to the next.",
    weight: 0.35,
    rationale:
      "The market moves every month to a building nobody is using, and nothing in the description says how anyone finds it."
  }
}

const drownedLibrary: PlaceScenarioDefinition = {
  id: "drowned-library",
  ...placeScenarioMeta["drowned-library"],
  recorded: {
    title: "The Library Under Cald Water",
    summary:
      "For one week in every ten, when the reservoir is drawn down for the dam, the drowned town's library stands in the open air and the town comes back to read.",
    atmosphere:
      "Mud dries pale on the steps, the lake stays in the smell of the stone, and every page is read at a window because the roof is gone.",
    features: [
      {
        name: "The steps",
        description:
          "Everyone comes down the same steps from the waterline, and each family stops on the one from which its own street can be seen.",
        weight: 0.5
      },
      {
        name: "Reading room",
        description:
          "In the reading room the tables stand where they stood, and the books that survived lie open on them to dry, in shelf order.",
        weight: 0.9
      },
      {
        name: "Borrowers' cards",
        description:
          "The card in each book still lists who took it and when, and the last date in most of them is the same week in 1961.",
        weight: 0.7
      },
      {
        name: "Waterline strip",
        description:
          "A brass strip on the doorframe is moved each decade to where the water stood, and it has never once been moved down.",
        weight: 0.4
      }
    ]
  },
  neighbor: {
    proposal: {
      name: "Dry shelf",
      description:
        "One shelf by the door is kept under oilcloth for the books written about the town since, and it is the only shelf allowed to be full.",
      weight: 0.5,
      rationale:
        "I have never seen the town except this week. Everything I know about it, someone wrote down after. Those books should be down here too."
    },
    note:
      "My grandmother's name is on the card in the blue atlas, north wall, second table. She took it out the week before and never brought it back. It is in my kitchen. I want to return it this week, properly, and I want you to stamp it."
  },
  programProposal: {
    name: "Closing bell",
    description:
      "On the seventh evening the bell from the drowned church is rung from the steps, and every book is closed and laid face down before the sluices shut.",
    weight: 0.45,
    rationale:
      "The town comes back for one week and the water returns after, but nothing says how the week ends or what is done with the books before it does."
  }
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
