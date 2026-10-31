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
    if (state.main !== "https://www.google.com/goto?url=fixture-main") throw new Error("result resolved without hover");
    if (state.normal !== "https://example.net/already-normal") throw new Error("normal link was changed");
    if (state.requests !== 0) throw new Error(`expected no requests on load, saw ${state.requests}`);
    return true;
  })()
' >/dev/null
agent-browser --session "$session" eval 'fixture.addDynamicResult()' >/dev/null
agent-browser --session "$session" wait 100 >/dev/null
agent-browser --session "$session" hover "#goto-fourth" >/dev/null
agent-browser --session "$session" wait 600 >/dev/null
agent-browser --session "$session" hover "#dynamic-link" >/dev/null
agent-browser --session "$session" wait 600 >/dev/null
agent-browser --session "$session" eval '
  (() => {
    const state = fixture.snapshot();
    if (state.fourth !== "https://example.com/resolved-fourth") throw new Error("hover did not resolve the link");
    if (state.dynamic !== "https://example.org/resolved-dynamic") throw new Error("hover did not resolve the dynamic result");
    if (state.main !== "https://www.google.com/goto?url=fixture-main") throw new Error("unhovered result was resolved");
    if (state.requests !== 2) throw new Error(`expected 2 requests after hover, saw ${state.requests}`);
    fixture.setEnabled(false);
    if (fixture.snapshot().fourth !== "https://www.google.com/goto?url=fixture-fourth") throw new Error("hovered link was not restored");
    return true;
  })()
' >/dev/null

echo "Browser fixture passed"
