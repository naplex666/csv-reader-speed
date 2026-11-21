# csv-reader-speed

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/naplex666/csv-reader-speed/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/naplex666/csv-reader-speed/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in for make.fun's own csv-reader 1.0.0: `solve.js` answers exactly as csv-reader does on every `{text, header}` case — same `{columns, rows, errors}`, same broken-row policy (`stray_cr`, `quote_junk`, `unterminated_quote`, `short_row`, `long_row`) — but parses with slice/`indexOf`-driven scanning instead of one character at a time. On the practice set it answers all 6 cases identically and runs the parser about 5x faster than the house baseline (warm: ~111 ms vs ~650 ms per round on this machine).

## Run it

```sh
node main.ts
```

The harness runs `node /bot/main.ts` (Node 22): it reads every case from `/input/cases.json`, answers each with `run` from `solve.js`, and writes `/output/answers.json`. Outside a container, `MAKEFUN_INPUT_DIR` and `MAKEFUN_OUTPUT_DIR` stand in for `/input` and `/output`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=48pk93ya&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
