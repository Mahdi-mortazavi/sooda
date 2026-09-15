# The rates file — what it is, and what the maintainer must fill in

Sooda estimates a monthly price-growth rate for each product. Two of the three signals
behind that estimate come from a small public data file, `public/data/rates.json`:

| Signal | Where it comes from | Status today |
| --- | --- | --- |
| Your own price history | The shopkeeper's own device. Never leaves it. | Working, needs nothing |
| Category CPI | `cpi.categories` in the rates file | **filled — Mordad 1405, see below** |
| Free-market USD | `fx.series` in the rates file | **empty — see below** |

The app works with the file empty. Every reader treats a `null` as "no figure", the estimate
falls back to whatever signals it does have, and the rate card says so. Nothing is fabricated
to fill a gap, and nothing here is guessed.

## What is in the file today

CPI figures for **Mordad 1405**, supplied by the maintainer citing the Statistical Center of
Iran: overall **+3.4%/month**, food and beverages **+3.6%/month**, and **+3.3%/month** for every
other division until per-division figures are confirmed. Marked `"confidence": "secondary"`
because this repository cannot reach amar.org.ir to verify them (see below) — they were relayed,
not fetched.

Two things worth knowing about these numbers:

* They are **monthly**, and that is now the app's only basis. Until v1.5 the bundled default was
  an annual 89% (point-to-point), from which the engine derived ~5.45%/month. That badly
  overstates the current pace while inflation decelerates, and it inflated every suggested price.
* 3.4%/month compounds to about **49%/year**, which is lower than the 89% point-to-point figure
  for the same release. Both are true: one looks back over twelve months, the other measures
  this month. Sooda prices the future, so it uses the monthly one.

The FX series is deliberately still empty, so the dollar line stays hidden.

## Which sources were verified, and which could not be

Checked on 2026-09-15 from a cloud IP:

| Source | Result |
| --- | --- |
| `amar.org.ir` (Statistical Centre of Iran) | **Unreachable.** Connection reset / no response. |
| `cbi.ir` (Central Bank of Iran) | **Unreachable.** Connection reset / no response. |
| `sci.org.ir` | **Unreachable.** Connection reset / no response. |
| `api.tgju.org` (free-market USD) | **Reachable.** HTTP 200, ~3,950 daily rows, no key or cookie needed. |

The three official sites refuse connections from non-Iranian addresses, which is where GitHub's
hosted runners live. No automated CPI adapter is therefore possible, and CPI is maintained by
hand. This was tested from this project's cloud environment rather than from a GitHub runner
itself; the first scheduled run of `.github/workflows/rates.yml` is what confirms it there.

The one endpoint that does answer is an undocumented internal endpoint behind tgju.org's price
table, not a published API, and the site states no usage policy. Its adapter is written, tested
and verified against the live payload — but it ships **disabled**, because committing a third
party's numbers into a public MIT repository every day is a licensing decision that belongs to
the maintainer, not to the build.

## What to fill in, and how

Everything below is optional. Skipping it leaves the app working, with the estimate resting on
the shopkeeper's own recorded prices.

### 1. The dollar (takes a minute, repeat as often as you like)

```bash
npm run rates:set -- --fx 231300 --date 2026-09-15 \
  --source-name TGJU --source-url https://www.tgju.org/profile/price_dollar_rl
```

`--fx` is the free-market USD close **in toman**, `--date` defaults to today (UTC). The command
refuses anything implausible: a non-positive rate, a malformed or impossible date, a duplicate
date, or a move of more than 25% against the previous close. It writes `public/data/rates.json`
and nothing else.

To turn the automatic daily pull on instead, set `fx.adapter` to `"tgju"` in
`scripts/rates/config.json`. Read the caveat above first.

### 2. Category CPI (monthly, by hand — there is no automated path)

Set the overall index and stamp the month it belongs to:

```bash
npm run rates:cpi -- --overall 2.4 --as-of 2026-06 \
  --source-name "Statistical Centre of Iran" --source-url https://www.amar.org.ir
```

Then one call per category you have a figure for:

```bash
npm run rates:cpi -- --category food --monthly 3.1
npm run rates:cpi -- --category apparel --monthly 1.8
```

Every figure is a **monthly percent change** — not annual, and not an index level. The category
ids are `food apparel home digital beauty health auto stationery`; `other` is not one, because it
falls back to the overall index. Anything outside −5%…+30% is refused as implausible. Pass only
the categories you actually have: one left `null` falls back to `overall`, and if `overall` is
`null` too the category signal simply does not contribute.

Add `--dry-run` to any of these to see what would be written without touching the file.

### 3. After filling anything in

```bash
npm run rates:test       # the pipeline's own checks
npm run rates:fallback   # optional — see below
```

## Why `rates:fallback` is not part of the build

`src/data/rates.fallback.json` is the copy bundled into the app so that a very first launch has
something to show before any network answers. It is refreshed **deliberately**, not on every
build, and that is load-bearing:

the daily rates job commits `public/data/rates.json` to `main`, and `main` is what the Pages
deploy builds. If the build copied that file into the bundle, each day's rate would change a
content-hashed chunk, which would change the precache manifest inside `sw.js`, which would
prompt every installed device to update — daily, for a number the app already fetches at
runtime. So the served file is the live one, and the bundled copy is a release-time snapshot.

Run `npm run rates:fallback` when cutting a release, if you want new installs to start from
current figures. Never wire it to `prebuild`.

## The daily job

`.github/workflows/rates.yml` runs at 02:20 UTC and on demand. FX commits straight to `main`;
CPI opens a pull request instead, because a wrong monthly print quietly skews every margin the
app suggests and deserves a human glance. With both adapters set to `"manual"` the job runs,
finds nothing to do, and exits green — which is the expected state until a maintainer opts in.
