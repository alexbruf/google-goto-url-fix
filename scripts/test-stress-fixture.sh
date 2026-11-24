#!/bin/sh
# Measures content-script work on a page that keeps changing. Prints one JSON line per mode
# and fails if the extension keeps rewriting links that the page puts back.
set -eu
session="goto-stress"
task_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cleanup() { agent-browser --session "$session" close >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM

for mode in revert churn; do
  agent-browser --session "$session" --allow-file-access open "file://$task_root/test/stress.html?mode=$mode" >/dev/null
  agent-browser --session "$session" wait 3000 >/dev/null
  result=$(agent-browser --session "$session" eval 'JSON.stringify(stress.snapshot())')
  echo "$result"
  if [ "$mode" = "revert" ]; then
    agent-browser --session "$session" eval '
      (() => {
        const { extensionHrefWrites } = stress.snapshot();
        // 100 links, each allowed a few rewrites before the extension gives up on it.
        if (extensionHrefWrites > 400) throw new Error(`extension kept fighting the page: ${extensionHrefWrites} rewrites`);
        return true;
      })()
    ' >/dev/null
  fi
done
echo "Stress fixture passed"
