#!/bin/sh
set -eu
session="goto-prefetch-e2e"
task_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cleanup() { agent-browser --session "$session" close >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM
agent-browser --session "$session" --allow-file-access open "file://$task_root/test/fixture.html?prefetch=1" >/dev/null
agent-browser --session "$session" wait 4000 >/dev/null
agent-browser --session "$session" eval '
  (() => {
    const state = fixture.snapshot();
    if (state.requests < 1 || state.requests > 2) throw new Error(`expected one or two prefetches, saw ${state.requests}`);
    if (!state.messages.every(message => message.prefetch === true)) throw new Error("unexpected non-prefetch request");
    if (document.querySelector("#local-result").href !== "https://example.org/local") throw new Error("local destination was not resolved");
    return true;
  })()
' >/dev/null
agent-browser --session "$session" open "file://$task_root/test/fixture.html?hold=1" >/dev/null
agent-browser --session "$session" wait 1800 >/dev/null
agent-browser --session "$session" eval '
  (() => {
    const first = fixture.snapshot().messages.find(message => message.prefetch);
    if (!first) throw new Error("prefetch did not start");
    const same = [...document.querySelectorAll("a[href]")].find(anchor => anchor.href === first.url);
    if (!same) throw new Error("prefetched anchor missing");
    same.focus();
    return true;
  })()
' >/dev/null
agent-browser --session "$session" wait 500 >/dev/null
agent-browser --session "$session" eval '
  (() => {
    const messages = fixture.snapshot().messages;
    if (!messages.some(message => message.type === "promote-goto" && message.url === messages[0].url)) throw new Error("submitted prefetch was not promoted");
    const another = [...document.querySelectorAll("a[href]")].find(anchor => anchor.href.includes("/goto?") && anchor.href !== messages[0].url);
    if (!another) throw new Error("second anchor missing");
    another.focus();
  })()
' >/dev/null
agent-browser --session "$session" wait 600 >/dev/null
agent-browser --session "$session" eval '
  (() => {
    if (!fixture.snapshot().messages.some(message => message.type === "resolve-goto" && !message.prefetch)) throw new Error(`interactive lookup was blocked behind prefetch: ${JSON.stringify(fixture.snapshot().messages)}`);
    fixture.releasePrefetch();
  })()
' >/dev/null
echo "Nearby prefetch fixture passed"
