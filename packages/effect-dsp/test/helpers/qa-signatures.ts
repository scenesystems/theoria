import { Schema } from "effect"
import * as Signature from "effect-dsp/Signature"

export const conciseFactsQaSignature = Signature.make(
  "Answer questions with concise facts",
  {
    question: Signature.describe(Schema.String, "The question to answer")
  },
  {
    answer: Signature.describe(Schema.String, "A concise factual answer")
  }
)

export const shortFactualAnswersQaSignature = Signature.make(
  "Answer questions with short factual answers",
  {
    question: Signature.describe(Schema.String, "The question to answer")
  },
  {
    answer: Signature.describe(Schema.String, "A concise factual answer")
  }
)
