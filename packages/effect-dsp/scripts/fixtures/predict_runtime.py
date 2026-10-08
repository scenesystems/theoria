import dspy
from dspy.utils import DummyLM

from ._common import history, state


def generate():
    model = DummyLM([{"reasoning": "because", "answer": "b"}])
    program = dspy.ChainOfThought("question -> answer")
    with dspy.context(lm=model, trace=[]):
        prediction = program(question="a")
        trace = [{"inputs": inputs, "outputs": outputs.toDict()} for _, inputs, outputs in dspy.settings.trace]
    cases = []
    for name, answers in [("majority", ["a", "b", "b"]), ("tie", ["b", "a"])]:
        winner = dspy.majority(dspy.Prediction.from_completions([{"answer": a} for a in answers]))
        cases.append({"name": name, "question": "choose", "programAnswers": answers,
                      "expectedAnswer": winner.answer})
    return [{"id": "predict-trace", "description": "ChainOfThought execution and selected predictor trace.",
             "payload": {"prediction": prediction.toDict(), "trace": trace,
                         "history": history(model), "state": state(program)}},
            {"id": "majority", "evidence": "upstream-kernel",
             "description": "Upstream majority reduction including a first-seen tie.",
             "payload": {"cases": cases}}]
