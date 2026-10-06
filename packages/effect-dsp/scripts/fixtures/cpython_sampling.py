"""Execute the pinned CPython integer-seeded generator and sequence algorithms."""
import random


def generate():
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
    return [{"id": "cpython-random-001", "evidence": "upstream-kernel",
             "description": "Pinned CPython MT19937 integer seeds and exact mixed-operation state consumption.",
             "payload": {"cases": cases}}]
