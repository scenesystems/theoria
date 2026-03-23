/**
 * Golden prompt fixtures for M1 prompt-construction contracts.
 */

export const qaPromptWithDemo = [
  {
    role: "system",
    content: "Task: Answer questions with concise facts\n\n" +
      "Instructions: Keep answers short.\n\n" +
      "Input fields:\n- question: The question to answer\n\n" +
      "Output fields:\n- answer: A concise factual answer\n\n" +
      "Output template:\n[[ ## answer ## ]]\n<answer>\n\n[[ ## completed ## ]]"
  },
  {
    role: "user",
    content: "[[ ## question ## ]]\nWhat is the capital of France?"
  },
  {
    role: "assistant",
    content: "[[ ## answer ## ]]\nParis"
  },
  {
    role: "user",
    content: "[[ ## question ## ]]\nWhat is the capital of Japan?\n\n" +
      "Respond with the corresponding output fields, starting with the field `[[ ## answer ## ]]`, " +
      "and then ending with the marker for `[[ ## completed ## ]]`."
  }
]

export const qaPromptWithoutDemos = [
  {
    role: "system",
    content: "Task: Answer questions with concise facts\n\n" +
      "Instructions: Keep answers short.\n\n" +
      "Input fields:\n- question: The question to answer\n\n" +
      "Output fields:\n- answer: A concise factual answer\n\n" +
      "Output template:\n[[ ## answer ## ]]\n<answer>\n\n[[ ## completed ## ]]"
  },
  {
    role: "user",
    content: "[[ ## question ## ]]\nWhat is the capital of Japan?\n\n" +
      "Respond with the corresponding output fields, starting with the field `[[ ## answer ## ]]`, " +
      "and then ending with the marker for `[[ ## completed ## ]]`."
  }
]
