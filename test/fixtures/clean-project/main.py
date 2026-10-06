import os
import sys


def parse_pairs(text):
    out = {}
    for part in text.split(","):
        if not part:
            continue
        key, _, value = part.partition("=")
        out[key.strip()] = value.strip()
    return out


def test_parse():
    assert parse_pairs("a=1") == {"a": 1}


if __name__ == "__main__":
    pairs = parse_pairs(sys.argv[1] if len(sys.argv) > 1 else "")
    for key, value in pairs.items():
        print(key, value, os.linesep)
