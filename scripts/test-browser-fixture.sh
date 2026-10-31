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
    if (state.main !== "https://example.com/resolved-main") throw new Error("first result was not resolved");
    if (state.third !== "https://example.com/resolved-third") throw new Error("third result was not resolved");
    if (state.fourth !== "https://www.google.com/goto?url=fixture-fourth") throw new Error("fourth result resolved without hover");
    if (state.citation !== "https://www.google.com/goto?url=fixture-citation") throw new Error("citation resolved without hover");
    if (state.normal !== "https://example.net/already-normal") throw new Error("normal link was changed");
    if (state.requests !== 3) throw new Error(`expected 3 background requests, saw ${state.requests}`);
    return true;
  })()
' >/dev/null
agent-browser --session "$session" eval 'fixture.addDynamicResult()' >/dev/null
agent-browser --session "$session" wait 100 >/dev/null
agent-browser --session "$session" hover "#goto-fourth" >/dev/null
agent-browser --session "$session" wait 400 >/dev/null
agent-browser --session "$session" eval '
  (() => {
    const state = fixture.snapshot();
    if (state.dynamic !== "https://www.google.com/goto?url=fixture-dynamic") throw new Error("dynamic result exceeded the background limit");
    if (state.fourth !== "https://example.com/resolved-fourth") throw new Error("hover did not resolve the link");
    if (state.requests !== 4) throw new Error(`expected 4 requests after hover, saw ${state.requests}`);
    fixture.setEnabled(false);
    if (fixture.snapshot().main !== "https://www.google.com/goto?url=fixture-main") throw new Error("first result was not restored");
    if (fixture.snapshot().fourth !== "https://www.google.com/goto?url=fixture-fourth") throw new Error("hovered link was not restored");
    return true;
  })()
' >/dev/null

echo "Browser fixture passed"
