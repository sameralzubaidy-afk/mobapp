#!/usr/bin/env python3
"""v2 evidence scanner — no date cutoff (evidence through today).

Parses every QA-run evidence file into per-case verdict evidence:
  - e2e-test-results/**/report.md            (manual + automated report.md)
  - e2e-test-results/**/*decision*log*.md    (Full Decision-and-Outcome Logs)
  - e2e-test-results/**/results.json         (automated authoritative)
  - test-automation/trade-flow-v2/reports/**/report.md + results.json
  - known standalone per-TC verdict .md reports at repo root (manual scan list)

Outputs (temp/tc-inventory-v2/):
  report-evidence-v2.tsv   path,date,wc,source_type,src_kind,tc_id,verdict
  report-register-v2.tsv   path,date,wc,source_type,src_kind,rollup,...

Read-only w.r.t. guides/code/reports.
"""
import glob
import os
import re
from collections import Counter, defaultdict

ROOT = "/Users/sameralzubaidi/Desktop/kids_marketplace_app"
OUT = os.path.join(ROOT, "temp/tc-inventory-v2/report-evidence-v2.tsv")
REG = os.path.join(ROOT, "temp/tc-inventory-v2/report-register-v2.tsv")

FULL_TC_RE = re.compile(r"\b([A-Z]{2,5}-TC-(?:REG-)?[A-Z]?\d+(?:[a-z])?(?:\.\d+)?)\b")
BARE_TC_RE = re.compile(r"\b(TC-[A-Z]\d+(?:[a-z])?(?:\.\d+)?|REG-R\d+(?:\.\d+)?)\b")
SUFFIX_TC_RE = re.compile(r"\b([A-Z]\d+(?:[a-z])?)\b")
VERDICT_RE = re.compile(r"\b(PASS|FAIL|BLOCKED|SKIPPED)\b", re.IGNORECASE)
ROLLUP_RE = re.compile(
    r"([0-9]+)\s*PASS(?: \(partial\))?\s*/\s*([0-9]+)\s*FAIL\s*/\s*([0-9]+)\s*BLOCKED\s*/\s*([0-9]+)\s*SKIPPED",
    re.IGNORECASE,
)
DATE_IN_DIR_RE = re.compile(r"(20\d{2})[-_](\d{2})[-_](\d{2})")
DATE_IN_HEADER_RE = re.compile(r"\*\*(?:Date|Run date|Run):\*\*\s*([0-9]{4}-[0-9]{2}-[0-9]{2})")
DATE_IN_ISO_RE = re.compile(r"(20\d{2})-(\d{2})-(\d{2})")
WALLCLOCK_RE = re.compile(r"(?:wall-clock|began local|local|started)\s*(?:approx\.?\s*)?(\d{1,2}):(\d{2})")
WALLCLOCK_IN_DATE_RE = re.compile(r"\*\*Date:\*\*[^\n]{0,120}?wall-clock\s*(\d{1,2}):(\d{2})")

GUIDE_PREFIX_FROM_PATH = [
    ("AUTH-ONBOARDING", "AUTH"),
    ("MESSAGING-BADGES", "MSG"),
    ("TradeFlowV2", "TRD"),
    ("MODULE-ACCOUNT", "ACC"),
    ("MODULE-ADMIN", "ADM"),
    ("MODULE-SUBSCRIPTIONS", "SUB"),
]


def dir_date(path):
    m = DATE_IN_DIR_RE.search(path)
    return f"{m.group(1)}-{m.group(2)}-{m.group(3)}" if m else None


def header_date(text):
    for rx in (DATE_IN_HEADER_RE,):
        m = rx.search(text[:3000])
        if m:
            return m.group(1)
    return None


def parse_date(path, text):
    return dir_date(path) or header_date(text) or "unknown"


def wallclock_minutes(text):
    m = WALLCLOCK_IN_DATE_RE.search(text[:2500])
    if not m:
        m = WALLCLOCK_RE.search(text[:2500])
    if m:
        h, mm = int(m.group(1)), int(m.group(2))
        if 0 <= h <= 23 and 0 <= mm <= 59:
            return h * 60 + mm
    return 0


def detect_guide_prefix(text, first_full_ids):
    for line in text.splitlines():
        for frag, prefix in GUIDE_PREFIX_FROM_PATH:
            if frag in line and ("guide" in line.lower() or "TC-" in line):
                return prefix
    if first_full_ids:
        return first_full_ids[0].split("-TC-")[0]
    return None


def is_automated_report(text):
    return "✅ Passed" in text and ("❌ Failed" in text or "⏭️ Skipped" in text or "⏭️ Coverage gaps" in text)


def parse_automated_from_results(run_dir):
    rj = os.path.join(run_dir, "results.json")
    if not os.path.exists(rj):
        return None
    import json
    try:
        d = json.load(open(rj, encoding="utf-8"))
    except Exception:
        return None
    out = []
    for u in d.get("units", []):
        verdict = "PASS" if u.get("passed") else "FAIL"
        for c in u.get("cases", []):
            out.append((c, verdict))
    for s in d.get("skipped", []):
        if isinstance(s, dict) and s.get("id"):
            out.append((s["id"], "SKIPPED"))
    return out


def parse_automated(text):
    verdict = None
    out = []
    for line in text.splitlines():
        s = line.strip()
        if s.startswith("## ✅ Passed"):
            verdict = "PASS"; continue
        if s.startswith("## ❌ Failures"):
            verdict = "FAIL"; continue
        if s.startswith("## ⏭️"):
            verdict = "SKIPPED"; continue
        if s.startswith("## "):
            verdict = None; continue
        if verdict is None:
            continue
        if s.startswith("### "):
            head = s[4:].split("—")[0]
            for m in re.finditer(r"[A-Z]+-TC-[A-Za-z0-9.]+|TC-[A-Z][A-Za-z0-9.]+|REG-R\d+(?:\.\d+)?", head):
                out.append((m.group(0), verdict))
    return out


def parse_manual(text, guide_prefix):
    """QA-agent manual format -> (explicit, suffix, inline)."""
    explicit, suffix, inline = [], [], []
    for line in text.splitlines():
        s = line.strip()
        is_table = s.startswith("|")
        joined = " | ".join(c.strip() for c in s.strip("|").split("|")) if is_table else s
        vm = VERDICT_RE.search(joined)
        if not vm:
            continue
        verdict = vm.group(1).upper()
        if "PARTIAL" in joined.upper():
            verdict = "PASS (partial)" if verdict == "PASS" else verdict
        full = list(dict.fromkeys(FULL_TC_RE.findall(joined)))
        if full:
            if "TC#" in joined or "Verdict" in joined:
                continue
            for tc in full:
                (explicit if is_table else inline).append((tc, verdict))
            continue
        if BARE_TC_RE.findall(joined):
            continue
        if guide_prefix and is_table:
            cells = [c.strip() for c in s.strip("|").split("|")]
            first_two = " ".join(cells[:2])
            if "TC#" in first_two or "Verdict" in first_two:
                continue
            sfx2 = SUFFIX_TC_RE.findall(first_two)
            if sfx2:
                for tok in sfx2:
                    suffix.append((f"{guide_prefix}-TC-{tok}", verdict))
    return explicit, suffix, inline


def walk_evidence_files():
    """Return list of (path, kind) where kind in {report.md, decision-log, results.json}."""
    files = []
    seen = set()
    for pat in ["e2e-test-results/*/report.md",
                "e2e-test-results/*/*/report.md",
                "test-automation/trade-flow-v2/reports/*/report.md",
                "test-automation/trade-flow-v2/reports/*/*/report.md"]:
        for f in glob.glob(os.path.join(ROOT, pat)):
            if f not in seen and "/archive/" not in f and "node_modules" not in f:
                files.append((f, "report.md")); seen.add(f)
    for pat in ["e2e-test-results/*/*decision*.md",
                "e2e-test-results/*/*/*decision*.md",
                "e2e-test-results/*/*decision*log*.md"]:
        for f in glob.glob(os.path.join(ROOT, pat)):
            if f not in seen and "/archive/" not in f and "node_modules" not in f:
                files.append((f, "decision-log")); seen.add(f)
    for pat in ["e2e-test-results/*/results.json",
                "test-automation/trade-flow-v2/reports/*/results.json"]:
        for f in glob.glob(os.path.join(ROOT, pat)):
            if f not in seen and "/archive/" not in f and "node_modules" not in f:
                files.append((f, "results.json")); seen.add(f)
    return sorted(files)


def main():
    files = walk_evidence_files()
    evidence, register = [], []
    for p, kind in files:
        text = open(p, encoding="utf-8", errors="replace").read()
        date = parse_date(p, text)
        wc = wallclock_minutes(text)
        rollup_m = ROLLUP_RE.search(text)
        rollup = tuple(int(x) for x in rollup_m.groups()) if rollup_m else None
        rel = p.replace(ROOT + "/", "")
        if kind == "results.json":
            stype, ev = "automated", []
            rr = parse_automated_from_results(os.path.dirname(p))
            if rr:
                seen = {}
                for tc, v in rr:
                    seen.setdefault(tc, v)
                ev = [(tc, v) for tc, v in seen.items()]
            n_ex, n_sf, n_in = len(ev), 0, 0
        elif is_automated_report(text):
            stype = "automated"
            seen = {}
            rr = parse_automated_from_results(os.path.dirname(p))
            if rr:
                for tc, v in rr:
                    seen.setdefault(tc, v)
            else:
                for tc, v in parse_automated(text):
                    seen.setdefault(tc, v)
            ev = [(tc, v) for tc, v in seen.items()]
            n_ex, n_sf, n_in = len(ev), 0, 0
        else:
            stype = "manual"
            full_any = list(dict.fromkeys(FULL_TC_RE.findall(text)))
            prefix = detect_guide_prefix(text, full_any)
            explicit, suffix, inline = parse_manual(text, prefix)
            seen = {}
            for tc, v in explicit + suffix + inline:
                seen.setdefault(tc, v)
            ev = [(tc, v) for tc, v in seen.items()]
            n_ex, n_sf, n_in = len(explicit), len(suffix), len(inline)
        for tc, v in ev:
            evidence.append((rel, date, wc, stype, kind, tc, v))
        rollup_s = "/".join(str(x) for x in rollup) if rollup else ""
        tc_refs = ",".join(sorted(set(FULL_TC_RE.findall(text)) | set(BARE_TC_RE.findall(text))))
        register.append((rel, date, wc, stype, kind, rollup_s, n_ex, n_sf, n_in, tc_refs))

    evidence.sort(key=lambda r: (r[1], r[2], r[0]))
    with open(OUT, "w", encoding="utf-8", newline="") as fh:
        fh.write("path\tdate\twc\tsource_type\tsrc_kind\ttc_id\tverdict\n")
        for r in evidence:
            fh.write("\t".join(str(x) for x in r) + "\n")
    with open(REG, "w", encoding="utf-8", newline="") as fh:
        fh.write("path\tdate\twc\tsource_type\tsrc_kind\trollup_p_f_b_s\tn_explicit\tn_suffix\tn_inline\ttc_refs\n")
        for r in register:
            fh.write("\t".join(str(x) for x in r) + "\n")

    print(f"Evidence files parsed: {len(files)}")
    print(f"Evidence rows:         {len(evidence)}")
    for st, n in sorted(Counter(r[3] for r in evidence).items()):
        print(f"  {st}: {n}")
    for k, n in sorted(Counter(r[4] for r in evidence).items()):
        print(f"  kind {k}: {n}")
    print("Verdict counts:")
    for v, n in sorted(Counter(r[6] for r in evidence).items()):
        print(f"  {v}: {n}")


if __name__ == "__main__":
    main()
