import dspy


def generate():
    signature = dspy.Signature("question -> answer")
    adapter = dspy.ChatAdapter()
    completion = "[[ ## answer ## ]]\nd\n\n[[ ## completed ## ]]"
    return [{"id": "chat-adapter-001", "evidence": "upstream-kernel",
             "description": "ChatAdapter formats a labeled demo and parses its completion.",
             "payload": {"completion": completion,
                         "messages": adapter.format(signature, demos=[dspy.Example(question="a", answer="b")],
                                                    inputs={"question": "c"}),
                         "parsed": adapter.parse(signature, completion)}}]
