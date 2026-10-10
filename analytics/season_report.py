#!/usr/bin/env python3
"""Independent cross-check of the demo season (stdlib only).

Reads data/demo-fields.csv (exported by `npm run seed:export`) and prints the
numbers an officer would care about, computed separately from the TypeScript
engine so the two can be compared.

    python3 analytics/season_report.py [path/to/demo-fields.csv]
"""
import csv
import statistics
import sys
from collections import Counter, defaultdict
from datetime import date

STRAW_T_PER_ACRE = 2.6   # same factor as server/lib/constants.ts
CO2_KG_PER_TONNE = 1460


def load(path):
    with open(path, newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    for r in rows:
        r["acres"] = float(r["acres"])
        r["windowDays"] = int(r["windowDays"])
        r["harvestDate"] = date.fromisoformat(r["harvestDate"])
    return rows


def main(path):
    rows = load(path)
    pending = [r for r in rows if r["status"] == "pending"]
    acres = sum(r["acres"] for r in rows)
    sizes = [r["acres"] for r in rows]
    by_pref = Counter(r["preference"] for r in rows)
    by_village = defaultdict(float)
    for r in pending:
        by_village[r["villageId"]] += r["acres"]
    peak = Counter(r["harvestDate"] for r in pending).most_common(1)[0]
    straw = acres * STRAW_T_PER_ACRE

    print(f"Fields            : {len(rows)} ({len(pending)} pending, {len(rows) - len(pending)} cleared)")
    print(f"Total area        : {acres:,.0f} acres  (median field {statistics.median(sizes):.1f} ac)")
    print(f"Small farms <5 ac : {sum(s < 5 for s in sizes) / len(sizes):.0%}")
    print(f"Straw to manage   : {straw:,.0f} t  ->  {straw * CO2_KG_PER_TONNE / 1000:,.0f} t CO2 if burnt")
    print(f"Method preference : " + ", ".join(f"{k} {v}" for k, v in by_pref.most_common()))
    print(f"Peak harvest day  : {peak[0]} ({peak[1]} fields)")
    print("Busiest villages  : " + ", ".join(f"{v} {a:.0f}ac" for v, a in sorted(by_village.items(), key=lambda x: -x[1])[:3]))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "data/demo-fields.csv")
