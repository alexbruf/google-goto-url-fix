#!/bin/sh
set -eu

session="goto-fixture-e2e"
task_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
fixture="file://$task_root/test/fixture.html"

cleanup() {
  agent-browser --session "$session" close >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

agent-browser --session "$session" --allow-file-access open "$fixture" >/dev/null
agent-browser --session "$session" wait --text "Fixture ready" >/dev/null
agent-browser --session "$session" eval '
  (() => {
    const state = fixture.snapshot();
    if (state.main !== "https://example.com/resolved-main") throw new Error("initial goto link was not resolved");
    if (state.normal !== "https://example.net/already-normal") throw new Error("normal link was changed");
    return true;
  })()
' >/dev/null
agent-browser --session "$session" eval 'fixture.addDynamicResult()' >/dev/null
agent-browser --session "$session" wait 100 >/dev/null
agent-browser --session "$session" eval '
  (() => {
    if (fixture.snapshot().dynamic !== "https://example.org/resolved-dynamic") throw new Error("dynamic link was not resolved");
    fixture.setEnabled(false);
    const state = fixture.snapshot();
    if (state.main !== "https://www.google.com/goto?url=fixture-main") throw new Error("initial link was not restored");
    if (state.dynamic !== "https://www.google.com/goto?url=fixture-dynamic") throw new Error("dynamic link was not restored");
    return true;
  })()
' >/dev/null

echo "Browser fixture passed"
