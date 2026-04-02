/**
 * Typed program synthesis contracts for the effect-dsp deep dive.
 *
 * Defines evaluation scenarios grounded in Scene Systems' computational
 * social science domain. Each scenario maps to a constitutional invariant:
 *
 * - **Intervention Classifier** → Participant Parity (human = AI, same contract)
 * - **Member-Check Summary** → Contract = Execution (approved schema IS execution)
 * - **Probe Follow-Up** → Audit is Output (trace IS the audit trail)
 *
 * @since 0.1.0
 * @module
 */
import { Schema } from "effect"
import * as Arr from "effect/Array"

// ---------------------------------------------------------------------------
// Scenario identity
// ---------------------------------------------------------------------------

/**
 * Each scenario exercises a different `effect-dsp` capability against a
 * domain-relevant evaluation task. The server runs the full pipeline:
 * define signature → baseline evaluate → optimize → re-evaluate.
 */
export const DspScenarioId = Schema.Literal(
  "intervention-classifier",
  "member-check-summary",
  "probe-follow-up"
)

export type DspScenarioId = typeof DspScenarioId.Type

// ---------------------------------------------------------------------------
// Module type — predict vs chainOfThought
// ---------------------------------------------------------------------------

export const DspModuleType = Schema.Literal("predict", "chainOfThought")

export type DspModuleType = typeof DspModuleType.Type

// ---------------------------------------------------------------------------
// Evaluation example — input/expected pair shown in the UI
// ---------------------------------------------------------------------------

export const DspEvaluationExample = Schema.Struct({
  input: Schema.Record({ key: Schema.String, value: Schema.String }),
  expected: Schema.Record({ key: Schema.String, value: Schema.String })
})

export type DspEvaluationExample = typeof DspEvaluationExample.Type

// ---------------------------------------------------------------------------
// Signature field metadata — what the UI displays for the typed contract
// ---------------------------------------------------------------------------

export const DspFieldMeta = Schema.Struct({
  name: Schema.String.pipe(Schema.minLength(1)),
  description: Schema.String.pipe(Schema.minLength(1))
})

export type DspFieldMeta = typeof DspFieldMeta.Type

export const DspSignatureContract = Schema.Struct({
  instruction: Schema.String.pipe(Schema.minLength(1)),
  inputFields: Schema.Array(DspFieldMeta),
  outputFields: Schema.Array(DspFieldMeta)
})

export type DspSignatureContract = typeof DspSignatureContract.Type

// ---------------------------------------------------------------------------
// Scenario definition — the full scenario metadata
// ---------------------------------------------------------------------------

export const DspScenarioDefinition = Schema.Struct({
  id: DspScenarioId,
  label: Schema.String.pipe(Schema.minLength(1)),
  invariant: Schema.String.pipe(Schema.minLength(1)),
  invariantDescription: Schema.String.pipe(Schema.minLength(1)),
  contract: DspSignatureContract,
  examples: Schema.Array(DspEvaluationExample),
  metricName: Schema.String.pipe(Schema.minLength(1)),
  metricDescription: Schema.String.pipe(Schema.minLength(1))
})

export type DspScenarioDefinition = typeof DspScenarioDefinition.Type

// ---------------------------------------------------------------------------
// Scenario catalog — the authoritative dataset
// ---------------------------------------------------------------------------

const interventionClassifier: DspScenarioDefinition = {
  id: "intervention-classifier",
  label: "Intervention Classifier",
  invariant: "Participant Parity",
  invariantDescription:
    "Human and AI coders operate under the same typed I/O contract — same input schema, same output labels, same validation.",
  contract: {
    instruction:
      "Analyze an observed behavior pattern and classify it into one intervention type: norms, incentives, or information.",
    inputFields: [
      { name: "observation", description: "Observed behavior pattern from field data" },
      { name: "population", description: "Population under study" }
    ],
    outputFields: [
      { name: "intervention", description: "One label: norms, incentives, or information" },
      { name: "rationale", description: "Short argument for the selected intervention" }
    ]
  },
  examples: [
    {
      input: {
        observation:
          "Students under-report stress because they think everyone else is coping, and they avoid campus counseling.",
        population: "first-year undergraduates"
      },
      expected: {
        intervention: "norms",
        rationale: "Norm correction can reduce misperceived stigma around help-seeking."
      }
    },
    {
      input: {
        observation: "Factory operators complete safety recertification only after attendance bonuses are introduced.",
        population: "shift-based manufacturing workers"
      },
      expected: {
        intervention: "incentives",
        rationale: "Behavior is tightly coupled to immediate compensation signals."
      }
    },
    {
      input: {
        observation:
          "Caregivers skip nutrition workshops because materials are dense and schedules are hard to decode.",
        population: "low-income caregivers"
      },
      expected: {
        intervention: "information",
        rationale: "Comprehension and access barriers dominate participation decisions."
      }
    },
    {
      input: {
        observation: "Tenants recycle more when building lobbies show floor-level participation dashboards.",
        population: "urban apartment residents"
      },
      expected: {
        intervention: "norms",
        rationale: "Visible social comparison cues raise compliance with pro-social behavior."
      }
    }
  ],
  metricName: "exactMatch",
  metricDescription: "Exact match on intervention label"
}

const memberCheckSummary: DspScenarioDefinition = {
  id: "member-check-summary",
  label: "Member-Check Summary",
  invariant: "Contract = Execution",
  invariantDescription:
    "The typed output schema guarantees the AI returns exactly what the consent form promised — no more, no less.",
  contract: {
    instruction:
      "Summarize a participant's budget allocation rationale for member-checking. Return a concise summary, key themes, and a statement preserving participant agency.",
    inputFields: [
      { name: "transcript", description: "Participant's explanation of their budget allocation" },
      { name: "allocation", description: "Budget allocation as category:amount pairs" }
    ],
    outputFields: [
      { name: "summary", description: "Concise plain-language summary of the participant's reasoning" },
      { name: "keyThemes", description: "Comma-separated key themes from the response" },
      { name: "participantAgency", description: "Statement preserving participant's expressed agency and intent" }
    ]
  },
  examples: [
    {
      input: {
        transcript:
          "I put most of the budget into transit because my neighborhood has no bus service after 6pm. Without reliable transit, people can't get to evening jobs or medical appointments. Parks are nice but they don't solve the isolation problem.",
        allocation: "transit:60, parks:15, libraries:25"
      },
      expected: {
        summary:
          "Prioritized transit funding to address evening service gaps that limit access to employment and healthcare.",
        keyThemes: "transit access, evening service, employment mobility, healthcare access",
        participantAgency:
          "The participant chose transit investment based on direct experience with service gaps affecting their neighborhood."
      }
    },
    {
      input: {
        transcript:
          "Libraries are the only free indoor space in our area. Kids go there after school, seniors use the computers, job seekers print resumes. Cutting library hours would remove the last shared space we have.",
        allocation: "libraries:50, transit:30, parks:20"
      },
      expected: {
        summary:
          "Prioritized library funding as the community's primary shared indoor space serving children, seniors, and job seekers.",
        keyThemes: "shared spaces, after-school care, digital access, community cohesion",
        participantAgency:
          "The participant advocated for libraries based on observed multi-generational reliance on the space."
      }
    },
    {
      input: {
        transcript:
          "I split it evenly because I don't think any single investment fixes the whole problem. Transit helps people move, parks help people gather, libraries help people learn. You need all three.",
        allocation: "transit:34, parks:33, libraries:33"
      },
      expected: {
        summary:
          "Distributed funding equally across all three categories, viewing them as complementary infrastructure.",
        keyThemes: "balanced investment, complementary services, holistic approach",
        participantAgency:
          "The participant deliberately chose equal allocation based on a systems-level view of community needs."
      }
    }
  ],
  metricName: "themeF1",
  metricDescription: "F1 score on key theme extraction"
}

const probeFollowUp: DspScenarioDefinition = {
  id: "probe-follow-up",
  label: "Probe Follow-Up",
  invariant: "Audit is Output",
  invariantDescription:
    "Every LM call produces typed trace evidence — the trace IS the audit trail, not a separate logging system.",
  contract: {
    instruction:
      "Generate a follow-up probe question for a deliberation participant. Classify the probe type and recommend whether to stop probing.",
    inputFields: [
      { name: "response", description: "Participant's most recent response" },
      { name: "context", description: "Summary of prior turns in this deliberation" },
      { name: "turnNumber", description: "Current turn number (1-indexed)" }
    ],
    outputFields: [
      { name: "followUp", description: "The follow-up question to ask" },
      { name: "probeType", description: "One of: clarification, elaboration, challenge, reflection" },
      { name: "stopRecommendation", description: "yes or no — whether to stop probing after this turn" }
    ]
  },
  examples: [
    {
      input: {
        response: "I think the transit budget should be higher because people in my area can't get to work without it.",
        context: "First response in the deliberation. Participant allocated 60% to transit.",
        turnNumber: "1"
      },
      expected: {
        followUp:
          "You mentioned people can't get to work — could you describe a specific situation where transit access affected someone's ability to reach employment?",
        probeType: "elaboration",
        stopRecommendation: "no"
      }
    },
    {
      input: {
        response:
          "My neighbor lost her evening shift job because the last bus leaves at 5:30. She couldn't afford a car and the ride-share costs ate her entire wage gain.",
        context: "Turn 1: Participant allocated 60% to transit. Turn 2: Asked for specific example of transit impact.",
        turnNumber: "2"
      },
      expected: {
        followUp:
          "That's a concrete example. If evening bus service were extended, do you think that would change how you allocated the budget, or would your priorities stay the same?",
        probeType: "reflection",
        stopRecommendation: "no"
      }
    },
    {
      input: {
        response:
          "No, I'd keep the same allocation. Transit is the foundation — everything else depends on people being able to move around the city.",
        context: "Turn 1-2: Transit priority with specific example. Turn 3: Asked about allocation stability.",
        turnNumber: "3"
      },
      expected: {
        followUp:
          "You've been consistent in your reasoning. Is there anything about the other categories — parks or libraries — that you considered but decided against prioritizing?",
        probeType: "clarification",
        stopRecommendation: "yes"
      }
    }
  ],
  metricName: "probeAccuracy",
  metricDescription: "Exact match on probe type classification"
}

/**
 * The authoritative scenario catalog. Ordered by constitutional invariant
 * progression: Parity → Contract → Audit.
 */
export const dspScenarios: ReadonlyArray<DspScenarioDefinition> = [
  interventionClassifier,
  memberCheckSummary,
  probeFollowUp
]

export const defaultDspScenarioId: DspScenarioId = "intervention-classifier"

export const defaultDspModuleType: DspModuleType = "chainOfThought"

export const defaultOptimizationBudget = 2

/**
 * Look up a scenario by ID.
 */
export const scenarioById = (id: DspScenarioId): DspScenarioDefinition =>
  Arr.findFirst(dspScenarios, (s) => s.id === id).pipe(
    (opt) => opt._tag === "Some" ? opt.value : interventionClassifier
  )

// ---------------------------------------------------------------------------
// Scenario options for ChoicePills
// ---------------------------------------------------------------------------

export const dspScenarioOptions: ReadonlyArray<{ readonly index: number; readonly label: string }> = Arr.map(
  dspScenarios,
  (s, index) => ({ index, label: s.label })
)

export const dspModuleTypeOptions: ReadonlyArray<{ readonly index: number; readonly label: string }> = [
  { index: 0, label: "Chain of Thought" },
  { index: 1, label: "Predict" }
]

export const moduleTypeFromIndex = (index: number): DspModuleType => index === 1 ? "predict" : "chainOfThought"

export const moduleTypeToIndex = (moduleType: DspModuleType): number => moduleType === "predict" ? 1 : 0
