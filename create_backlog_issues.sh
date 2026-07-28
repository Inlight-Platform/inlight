#!/usr/bin/env bash
set -euo pipefail

REPO="Inlight-Platform/inlight"
BACKLOG_FILE="docs/github-issues.md"

# Do NOT modify source file
if [[ ! -f "$BACKLOG_FILE" ]]; then
  echo "Missing $BACKLOG_FILE"
  exit 1
fi

# Required labels from backlog header
REQUIRED_LABELS=(
  "priority: urgent"
  "priority: high"
  "priority: medium"
  "priority: low"
  "type: bug"
  "type: feature"
  "type: cleanup"
  "area: auth"
  "area: profile"
  "area: industry-now"
  "area: projects"
  "area: opportunities"
  "area: messaging"
  "area: events"
  "area: admin"
  "area: mobile"
  "area: supabase"
  "area: media"
  "area: resources"
  "area: people"
  "area: company"
  "area: feed"
  "area: discovery"
  "area: notifications"
)

echo "Repository: $REPO"
echo "Ensuring labels exist..."

for lbl in "${REQUIRED_LABELS[@]}"; do
  if ! gh label list -R "$REPO" --limit 500 --json name -q '.[].name' | grep -Fxq "$lbl"; then
    gh label create "$lbl" -R "$REPO" --color "BFD4F2" --description "Backlog label"
    echo "  created: $lbl"
  fi
done

python3 - <<'PY'
import re, subprocess, json, sys
from pathlib import Path

repo = "Inlight-Platform/inlight"
text = Path("docs/github-issues.md").read_text(encoding="utf-8")

start = text.find("## Ready-to-create issues")
end = text.find("## Lower-confidence notes to clarify before issue creation")
if start == -1 or end == -1 or end <= start:
    print("Could not locate required sections")
    sys.exit(1)
section = text[start:end]

# Split issue blocks: ### N. Title
blocks = re.split(r'\n(?=###\s+\d+\.\s+)', section)
issues = []

for b in blocks:
    m = re.search(r'^###\s+(\d+)\.\s+(.+)$', b, re.M)
    if not m:
        continue
    n = int(m.group(1))
    title = m.group(2).strip()

    lm = re.search(r'Labels:\s*(.+)', b)
    if not lm:
        print(f"Missing labels for #{n}")
        sys.exit(1)
    labels = [x.strip().strip('`') for x in lm.group(1).split(",")]

    # Description = first paragraph after labels line
    after_labels = b[lm.end():].strip()
    # Split at "Acceptance criteria:"
    am = re.search(r'Acceptance criteria:\s*', after_labels)
    if not am:
        print(f"Missing acceptance criteria for #{n}")
        sys.exit(1)

    desc = after_labels[:am.start()].strip()
    criteria_block = after_labels[am.end():].strip()

    crit = []
    for line in criteria_block.splitlines():
        line = line.strip()
        if line.startswith("- "):
            crit.append(line[2:].strip())

    if not desc or not crit:
        print(f"Incomplete block #{n}")
        sys.exit(1)

    # priority label
    pr = next((l for l in labels if l.startswith("priority: ")), None)
    if not pr:
        print(f"Missing priority label for #{n}")
        sys.exit(1)

    issues.append({
        "source_n": n,
        "title": title,  # exact heading title without number
        "labels": labels,
        "priority": pr.replace("priority: ", "").strip(),
        "description": desc,
        "criteria": crit
    })

# Priority ordering: urgent, high, medium, low
rank = {"urgent": 0, "high": 1, "medium": 2, "low": 3}
issues.sort(key=lambda x: (rank.get(x["priority"], 99), x["source_n"]))

summary = []

for it in issues:
    body_lines = [
        "## Description",
        it["description"],
        "",
        "## Acceptance Criteria",
    ] + [f"- [ ] {c}" for c in it["criteria"]] + [
        "",
        "## Source",
        f"Source backlog item: #{it['source_n']}",
    ]
    body = "\n".join(body_lines)

    cmd = [
        "gh", "issue", "create",
        "-R", repo,
        "--title", it["title"],
        "--body", body,
    ]
    for l in it["labels"]:
        cmd += ["--label", l]

    out = subprocess.check_output(cmd, text=True).strip()
    # gh returns URL
    url = out.splitlines()[-1].strip()
    summary.append({
        "source_n": it["source_n"],
        "url": url,
        "title": it["title"],
        "priority": it["priority"],
        "areas": [l for l in it["labels"] if l.startswith("area: ")]
    })

# Print markdown summary table
print("\n| Source # | GitHub URL | Title | Priority | Area labels |")
print("|---:|---|---|---|---|")
for s in summary:
    print(f"| {s['source_n']} | {s['url']} | {s['title']} | {s['priority']} | {', '.join(s['areas'])} |")
PY