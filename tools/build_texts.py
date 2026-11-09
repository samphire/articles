#!/usr/bin/env python3
"""Build texts.json from the plain-text sources in texts/.

Source format (texts/easy.txt, texts/medium.txt, texts/hard.txt):

    === easy-short-01 | My New Bike
    First paragraph of the text, which can wrap
    over several lines.

    Second paragraph.

    === easy-short-02 | ...

The id is <level>-<length>-<number>. Never renumber or reuse an id once the app
is released: players' "completed" marks are stored against these ids.

Run from the project root:  python3 tools/build_texts.py
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEVELS = ["easy", "medium", "hard"]
WORD_RANGES = {"short": (40, 95), "medium": (110, 210), "long": (230, 400)}
MIN_ARTICLES = {"short": 4, "medium": 8, "long": 14}
HEADER = re.compile(r"^===\s*(\S+)\s*\|\s*(.+?)\s*$")
ID = re.compile(r"^(easy|medium|hard)-(short|medium|long)-(\d{2})$")
# Same rule as the app: exactly the/a/an once surrounding punctuation is ignored.
ARTICLE = re.compile(r"^[^\w]*(the|a|an)[^\w]*$", re.I)


def parse(path, level):
    entries, cur = [], None
    for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        m = HEADER.match(line)
        if m:
            cur = {"id": m.group(1), "title": m.group(2), "lines": [], "where": f"{path.name}:{n}"}
            entries.append(cur)
        elif cur is not None:
            cur["lines"].append(line.strip())
        elif line.strip():
            raise SystemExit(f"{path.name}:{n}: text before the first === header")
    out = []
    for e in entries:
        paragraphs = [" ".join(p.split("\n")).strip()
                      for p in "\n".join(e["lines"]).strip().split("\n\n") if p.strip()]
        m = ID.match(e["id"])
        if not m:
            raise SystemExit(f"{e['where']}: bad id {e['id']!r} (want e.g. {level}-short-01)")
        if m.group(1) != level:
            raise SystemExit(f"{e['where']}: id {e['id']} is in {path.name}")
        out.append({"id": e["id"], "level": level, "length": m.group(2), "title": e["title"],
                    "text": "\n\n".join(paragraphs), "where": e["where"]})
    return out


def check(t):
    """Return a list of warnings for one text."""
    words = t["text"].split()
    lo, hi = WORD_RANGES[t["length"]]
    problems = []
    if not lo <= len(words) <= hi:
        problems.append(f"{len(words)} words (expected {lo}-{hi})")
    flags = [bool(ARTICLE.match(w)) for w in words]
    hidden = sum(1 for i, f in enumerate(flags) if f and i + 1 < len(flags) and not flags[i + 1])
    if hidden < MIN_ARTICLES[t["length"]]:
        problems.append(f"only {hidden} articles (want at least {MIN_ARTICLES[t['length']]})")
    if flags and flags[-1]:
        problems.append("ends with an article (it won't be hidden)")
    if any(a and b for a, b in zip(flags, flags[1:])):
        problems.append("two articles in a row (the first won't be hidden)")
    return problems, len(words), hidden


def main():
    texts, seen, warnings = [], set(), 0
    for level in LEVELS:
        path = ROOT / "texts" / f"{level}.txt"
        for t in parse(path, level):
            if t["id"] in seen:
                raise SystemExit(f"{t['where']}: duplicate id {t['id']}")
            seen.add(t["id"])
            problems, nwords, narts = check(t)
            for p in problems:
                print(f"WARNING {t['where']} {t['id']}: {p}")
                warnings += 1
            t["words"], t["articles"] = nwords, narts
            texts.append(t)

    summary = {}
    for t in texts:
        summary.setdefault((t["level"], t["length"]), []).append(t)
    print(f"{'':8}" + "".join(f"{n:>22}" for n in WORD_RANGES))
    for level in LEVELS:
        cells = []
        for length in WORD_RANGES:
            ts = summary.get((level, length), [])
            avg_w = round(sum(x["words"] for x in ts) / len(ts)) if ts else 0
            avg_a = round(sum(x["articles"] for x in ts) / len(ts)) if ts else 0
            cells.append(f"{len(ts):>3} texts ~{avg_w:>3}w ~{avg_a:>2}a")
        print(f"{level:8}" + "".join(f"{c:>22}" for c in cells))

    public = [{k: t[k] for k in ("id", "level", "length", "title", "text")} for t in texts]
    (ROOT / "texts.json").write_text(json.dumps(public, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote texts.json: {len(public)} texts, {warnings} warnings")
    return 1 if warnings else 0


if __name__ == "__main__":
    sys.exit(main())
