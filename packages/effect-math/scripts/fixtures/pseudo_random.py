"""Execute CPython random and NumPy's frozen legacy RandomState algorithms."""
import importlib.metadata
import platform
import random

import numpy

from ._common import metadata


def document(name, cases, generated_at, upstream, version):
    provenance = metadata(generated_at)
    provenance["upstream"] = {"name": upstream, "version": version}
    return {"fixture": name, "metadata": provenance,
            "payload": {"cases": cases}, "file": name + ".json"}


def cpython_cases():
    cases = []
    for seed in [0, 1, 4294967313, -9876543210987654321]:
        rng = random.Random(seed)
        floats = [rng.random() for _ in range(700)]
        bits = [{"k": k, "value": str(rng.getrandbits(k))}
                for k in [0, 1, 31, 32, 33, 63, 64, 65, 127, 1024]]
        below = [{"n": str(n), "values": [str(rng._randbelow(n)) for _ in range(24)]}
                 for n in [1, 2, 3, 16, 17, 2**40 + 1]]
        integers = [{"a": a, "b": b, "values": [rng.randint(a, b) for _ in range(12)]}
                    for a, b in [(-7, 11), (4, 4), (0, 2**40)]]
        choices = [rng.choice(["a", "b", "c", "d", "e"]) for _ in range(24)]
        shuffles = []
        for n in [0, 1, 20, 35]:
            values = list(range(n))
            rng.shuffle(values)
            shuffles.append(values)
        samples = [{"n": n, "k": k, "value": rng.sample(range(n), k)}
                   for n, k in [(21, 5), (22, 5), (85, 6), (86, 6), (1000, 7), (1000, 0), (20, 20)]]
        cases.append({"seed": str(seed), "random": floats, "bits": bits, "below": below,
                      "integers": integers, "choices": choices, "shuffles": shuffles,
                      "samples": samples, "tail": [rng.random() for _ in range(8)]})
    return cases


def numpy_cases():
    cases = []
    tolerance = numpy.sqrt(numpy.finfo(numpy.float64).eps)
    for seed in [0, 9, 1, 2**32 - 1]:
        rng = numpy.random.RandomState(seed)
        floats = rng.random_sample(700).tolist()
        batches = [{"size": n, "values": rng.rand(n).tolist()} for n in [0, 6, 625]]
        uniform = [{"low": a, "high": b, "values": rng.uniform(a, b, 13).tolist()}
                   for a, b in [(-7.5, 2.25), (4.0, 4.0), (3.25, -1.75)]]
        choices = []
        for p in [[0.2, 0.3, 0.5], [0.0, 0.125, 0.875], [0.2, 0.3, 0.500000001]]:
            choices.append({"p": p, "values": rng.choice(len(p), p=p, size=200).tolist()})
        boundaries = []
        for scale in [1.0, 1 + 1e-9, 1 + tolerance / 2, 1 - tolerance / 2,
                      1 + tolerance * 2, 1 - tolerance * 2, 2.0, 0.0]:
            p = (numpy.array([0.2, 0.3, 0.5]) * scale).tolist()
            trial_rng = numpy.random.RandomState(seed)
            try:
                values = trial_rng.choice(3, p=p, size=200).tolist()
                boundaries.append({"p": p, "accepted": True, "values": values})
            except ValueError:
                boundaries.append({"p": p, "accepted": False, "values": []})
        cases.append({"seed": seed, "random": floats, "batches": batches,
                      "uniform": uniform, "choices": choices, "boundaries": boundaries,
                      "tail": rng.random_sample(8).tolist()})
    return cases


def generate(generated_at):
    return [document("cpython-random", cpython_cases(), generated_at, "cpython", platform.python_version()),
            document("numpy-random", numpy_cases(), generated_at, "numpy", importlib.metadata.version("numpy"))]
