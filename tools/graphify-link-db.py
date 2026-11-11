#!/usr/bin/env python3
"""Add code -> database edges to graphify-out/graph.json.

graphify's parsers see SQL objects and JS/TS symbols but not the string-based
links between them: supabase.from("class_bookings") and supabase.rpc("fn").
This script scans the source for those calls and adds edges from the calling
function (or the file, if no function precedes the call) to the matching SQL
table or function node.

Run it after every graphify build (full or --update); it removes the edges it
added last time before adding fresh ones, so it is safe to re-run.

    python3 tools/graphify-link-db.py            # from the repo root
    python3 tools/graphify-link-db.py --dry-run  # report only, write nothing
    python3 tools/graphify-link-db.py --no-html  # skip graph.html re-export

Edge relations added (all carry _origin "db_link"):
    reads_from   .from("t") chained to select (or no write method found)
    writes_to    .from("t") chained to insert/update/upsert/delete
    calls_rpc    .rpc("fn")
Confidence: EXTRACTED 1.0 when the edge starts at the file node, INFERRED 0.85
when it starts at the function whose body contains the call. The body end is
found by brace matching, since graph.json stores only each function's start
line. Calls inside anonymous handlers (e.g. serve(async (req) => ...)) have no
named function and attach to the file node.
"""
import argparse
import collections
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GRAPH = ROOT / "graphify-out" / "graph.json"
ORIGIN = "db_link"
SKIP_DIRS = {"vendor", "graphify-out", "node_modules", ".git"}
EXTS = {".js", ".mjs", ".ts", ".html"}
CALL = re.compile(r"\.(from|rpc)\(\s*(['\"`])([A-Za-z0-9_.]+)\2")
WRITE = re.compile(r"\.(insert|update|upsert|delete)\s*\(")
READ = re.compile(r"\.(select)\s*\(")
LOC = re.compile(r"L(\d+)")


def start_line(node):
    m = LOC.match(str(node.get("source_location") or ""))
    return int(m.group(1)) if m else None


def build_sql_index(nodes):
    """label without 'public.' / '()' -> list of SQL nodes, split by kind."""
    tables, funcs = collections.defaultdict(list), collections.defaultdict(list)
    for n in nodes:
        if not str(n.get("source_file", "")).endswith(".sql"):
            continue
        label = n.get("label", "")
        if not label.startswith("public."):
            continue
        name = label[len("public."):]
        if name.endswith("()"):
            funcs[name[:-2]].append(n)
        else:
            tables[name].append(n)
    return tables, funcs


def code_index(nodes):
    """source_file -> (file node, [(start_line, function node), ...] sorted)."""
    by_file = collections.defaultdict(list)
    for n in nodes:
        sf = n.get("source_file")
        if sf and not sf.endswith(".sql") and n.get("_origin") != "semantic":
            by_file[sf].append(n)
    out = {}
    for sf, ns in by_file.items():
        base = Path(sf).name
        # file nodes are labelled "index.ts" or "parent-dir/index.ts"
        file_node = next(
            (n for n in ns
             if (n.get("label") == base or str(n.get("label", "")).endswith("/" + base))
             and start_line(n) in (1, None)),
            None,
        )
        funcs = sorted(
            (start_line(n), n) for n in ns
            if str(n.get("label", "")).endswith("()") and start_line(n)
        )
        out[sf] = (file_node, funcs)
    return out


def find_end(text, offsets, start):
    """End line of the function that starts on line `start`, or None.

    Walks the source from the start line, skipping strings and comments, and
    stops at the brace that closes the first `{` (or at the first top-level `;`
    for brace-less arrows). If a brace shows up early, e.g. a destructured
    parameter, the end comes out too small. The call then falls back to the
    file node, which is coarser but never wrong.
    """
    i, n, depth, opened = offsets[start - 1], len(text), 0, False
    while i < n:
        c = text[i]
        if text.startswith("//", i):
            i = text.find("\n", i)
            if i < 0:
                return None
        elif text.startswith("/*", i):
            i = text.find("*/", i)
            if i < 0:
                return None
            i += 1
        elif c in "'\"`":
            i += 1
            while i < n and text[i] != c:
                i += 2 if text[i] == "\\" else 1
        elif c == "{":
            depth, opened = depth + 1, True
        elif c == "}":
            depth -= 1
            if opened and depth == 0:
                return text.count("\n", 0, i) + 1
        elif c == ";" and depth == 0 and not opened:
            return text.count("\n", 0, i) + 1
        i += 1
    return None


def enclosing(spans, line):
    """Innermost function whose body contains `line`."""
    best = None
    for start, end, n in spans:
        if start <= line <= end:
            best = n  # spans are sorted by start, so the last hit is innermost
    return best


def chain_kind(text, end):
    """Look at the call chain after .from("t") to decide read vs write."""
    chunk = text[end:end + 400]
    stop = re.search(r";\s*\n|\n\s*\n", chunk)
    if stop:
        chunk = chunk[:stop.start()]
    if WRITE.search(chunk):
        return "writes_to"
    return "reads_from"


def scan(tables, funcs, index):
    edges, unmatched = [], collections.Counter()
    for path in sorted(ROOT.rglob("*")):
        if path.suffix not in EXTS or not path.is_file():
            continue
        if SKIP_DIRS & set(path.relative_to(ROOT).parts):
            continue
        rel = path.relative_to(ROOT).as_posix()
        if rel not in index:
            continue
        file_node, fn_list = index[rel]
        text = path.read_text(encoding="utf-8", errors="replace")
        offsets = [0]
        for mm in re.finditer("\n", text):
            offsets.append(mm.end())
        spans = []
        for start, n in fn_list:
            if start <= len(offsets):
                end = find_end(text, offsets, start)
                if end:
                    spans.append((start, end, n))
        for m in CALL.finditer(text):
            kind, name = m.group(1), m.group(3).removeprefix("public.")
            line = text.count("\n", 0, m.start()) + 1
            targets = (funcs if kind == "rpc" else tables).get(name)
            if not targets:
                unmatched[("no SQL node", kind, name, rel)] += 1
                continue
            src = enclosing(spans, line)
            via_fn = src is not None
            src = src or file_node
            if src is None:
                unmatched[("no source node", kind, name, rel)] += 1
                continue
            relation = "calls_rpc" if kind == "rpc" else chain_kind(text, m.end())
            for t in targets:
                edges.append({
                    "source": src["id"], "target": t["id"], "relation": relation,
                    "confidence": "INFERRED" if via_fn else "EXTRACTED",
                    "confidence_score": 0.85 if via_fn else 1.0,
                    "source_file": rel, "source_location": f"L{line}",
                    "weight": 1.0, "_origin": ORIGIN,
                })
    return edges, unmatched


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--no-html", action="store_true")
    args = ap.parse_args()
    if not GRAPH.exists():
        sys.exit(f"{GRAPH} not found. Build the graph first (/graphify .).")

    g = json.loads(GRAPH.read_text(encoding="utf-8"))
    links = [e for e in g["links"] if e.get("_origin") != ORIGIN]
    removed = len(g["links"]) - len(links)
    tables, funcs = build_sql_index(g["nodes"])
    edges, unmatched = scan(tables, funcs, code_index(g["nodes"]))

    # one edge per (source, target, relation); keep the first call site
    seen, unique = set(), []
    for e in edges:
        k = (e["source"], e["target"], e["relation"])
        if k not in seen:
            seen.add(k)
            unique.append(e)

    rel_counts = collections.Counter(e["relation"] for e in unique)
    print(f"SQL objects indexed: {len(tables)} tables, {len(funcs)} functions")
    print(f"Edges found: {len(unique)} ({dict(rel_counts)}), "
          f"{len(edges) - len(unique)} duplicate call sites merged, "
          f"{removed} old db_link edges replaced")
    if unmatched:
        print(f"Skipped {sum(unmatched.values())} calls:")
        for (why, kind, name, rel), c in sorted(unmatched.items()):
            print(f"  [{why}] .{kind}('{name}')  {rel}  x{c}")
    if args.dry_run:
        print("Dry run: nothing written.")
        return

    g["links"] = links + unique
    GRAPH.write_text(json.dumps(g, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {GRAPH.relative_to(ROOT)}")
    exe = shutil.which("graphify")
    if not args.no_html and exe:
        subprocess.run([exe, "export", "html"], cwd=ROOT, check=False)
    elif not args.no_html:
        print("graphify CLI not on PATH: re-run `graphify export html` yourself.")


if __name__ == "__main__":
    main()
