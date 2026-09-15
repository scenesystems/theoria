/**
 * Golden prompt fixtures for prompt-construction contracts.
 */
import * as Prompt from "@effect/ai/Prompt"
import { Array as Arr } from "effect"

const system = Prompt.systemMessage({
  content: Arr.join(
    Arr.make(
      "Task: Answer questions with concise facts",
      "Instructions: Keep answers short.",
      "Input fields:\n- question: The question to answer",
      "Output fields:\n- answer: A concise factual answer",
      "Output template:\n[[ ## answer ## ]]\n<answer>\n\n[[ ## completed ## ]]"
    ),
    "\n\n"
  )
})

const request = Prompt.userMessage({
  content: Arr.make(Prompt.textPart({
    text: Arr.join(
      Arr.make(
        "[[ ## question ## ]]\nWhat is the capital of Japan?\n\n",
        "Respond with the corresponding output fields, starting with the field `[[ ## answer ## ]]`, ",
        "and then ending with the marker for `[[ ## completed ## ]]`."
      ),
      ""
    )
  }))
})

export const qaPromptWithDemo = Prompt.fromMessages(Arr.make(
  system,
  Prompt.userMessage({
    content: Arr.make(Prompt.textPart({ text: "[[ ## question ## ]]\nWhat is the capital of France?" }))
  }),
  Prompt.assistantMessage({ content: Arr.make(Prompt.textPart({ text: "[[ ## answer ## ]]\nParis" })) }),
  request
))

export const qaPromptWithoutDemos = Prompt.fromMessages(Arr.make(system, request))
