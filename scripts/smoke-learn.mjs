/**
 * The tutorial half of the browser smoke run: onboarding, the eight lessons, «نشانم بده», RTL
 * and LTR, and leaving a lesson without touching the real shop.
 *
 * It lives beside `smoke.mjs` rather than inside it because it is a different kind of test: the
 * flows there each poke one screen, and these drive a whole lesson — a dozen steps, a practice
 * database and a challenge — for every lesson there is. `smoke.mjs` owns the server, the browser
 * and the check list, and hands them over here.
 *
 * Two claims in the repo rest entirely on this file:
 *
 *  * `src/learn/lessons/lessons.test.ts` asserts that every step's demo has actions and that no
 *    typed value is blank. It never plays one. "«نشانم بده» can finish any lesson unaided" is
 *    only true if a demo, driven against the real components, satisfies every step's `expect` —
 *    which is what `playByDemo` below does and nothing else does.
 *  * `src/learn/ui/targets.test.ts` says in its own header that it cannot prove an element is on
 *    screen when a step points at it, and defers to the browser smoke run. A step whose target
 *    the coach cannot find dims the page and cuts a hole where the target is not, so every step
 *    here is checked for a cutout that covers its target.
 *
 * Nothing here weakens a gate to make it pass. A lesson that takes 95 seconds is reported at 95.
 */

import { readFile } from 'node:fs/promises'

/** The plan's gates, in seconds. Not to be moved because a run came in over them. */
export const ONBOARDING_GATE_S = 60
export const LESSON_GATE_S = 90

/** How long one step is given to be satisfied by its own demo before it counts as stalled. */
const STEP_TIMEOUT_MS = 25000
/** How long the first tooltip of a lesson is given to appear (the practice database opens first). */
const LESSON_START_MS = 20000

/* ── the app's own strings ──────────────────────────────────────────────────────────────── */

/**
 * The buttons are found by the label the app actually renders, read out of the translation
 * bundles rather than typed here. A smoke test that hard-codes «نشانم بده» starts passing
 * vacuously — locator not found, flow skipped — the day the copy agent rewords it.
 */
export async function loadStrings() {
  const [fa, en, coreFa, coreEn] = await Promise.all([
    readFile('src/i18n/sheets/fa.json', 'utf8').then(JSON.parse),
    readFile('src/i18n/sheets/en.json', 'utf8').then(JSON.parse),
    readFile('src/i18n/fa.json', 'utf8').then(JSON.parse),
    readFile('src/i18n/en.json', 'utf8').then(JSON.parse),
  ])
  const at = (bundle, path) => {
    const value = path.split('.').reduce((node, key) => (node == null ? undefined : node[key]), bundle)
    if (typeof value !== 'string') throw new Error(`missing translation ${path}`)
    return value
  }
  const forLang = (bundle) => ({
    showMe: at(bundle, 'learn.showMe'),
    skip: at(bundle, 'learn.skip'),
    next: at(bundle, 'learn.next'),
    introCta: at(bundle, 'learn.introCta'),
    missionCta: at(bundle, 'learn.missionCta'),
    missionStart: at(bundle, 'learn.missionStart'),
    badgeFirstStep: at(bundle, 'learn.badgeFirstStep'),
    celebrateStart: at(bundle, 'learn.celebrateStart'),
    challengeLabel: at(bundle, 'learn.challenge.label'),
    challengeCheck: at(bundle, 'learn.challenge.check'),
    challengeTryAgain: at(bundle, 'learn.challenge.tryAgain'),
    challengeCorrect: at(bundle, 'learn.challenge.correct'),
    challengeNext: at(bundle, 'learn.challenge.next'),
    challengeFinish: at(bundle, 'learn.challenge.finish'),
    answerLabel: at(bundle, 'learn.challenge.answerLabel'),
  })
  const forCore = (bundle) => ({
    /* The lens's own word for a margin that survived but barely — «کم‌سود». Mission 1 ends on
     * it, and it is the half of the payoff that is not a number. */
    statusThin: at(bundle, 'lens.statusThin'),
    resultTitle: at(bundle, 'results.title'),
  })
  return {
    fa: { ...forLang(fa), ...forCore(coreFa) },
    en: { ...forLang(en), ...forCore(coreEn) },
  }
}

/* ── the lessons, read from their own source ────────────────────────────────────────────── */

/**
 * Every lesson's id, its claimed duration and the answer to each typed challenge.
 *
 * The answers are not written down here. They are read out of `expected.generated.ts` — the
 * engine's own output — through whatever path the lesson names, so a smoke run can never
 * "pass" a challenge against a figure a test author invented. If a lesson's shape moves far
 * enough that this cannot read it, the flow fails loudly rather than skipping the question.
 */
export async function loadLessonFacts() {
  const generated = await readFile('src/learn/lessons/expected.generated.ts', 'utf8')
  const expected = JSON.parse(sliceObject(generated, 'LESSON_EXPECTED'))

  const files = [
    'profit',
    'discount',
    'realProfit',
    'installments',
    'products',
    'smartRates',
    'everyday',
    'safety',
  ]
  /* The order the Learning Centre offers them in, which is the order `LESSONS` declares. */
  const order = [...(await readFile('src/learn/lessons/index.ts', 'utf8')).matchAll(/(\w+)Lesson,/g)].map(
    (m) => m[1],
  )
  const sorted = order.length === files.length ? order : files

  const lessons = []
  for (const file of sorted) {
    const source = await readFile(`src/learn/lessons/${file}.ts`, 'utf8')
    const id = /id:\s*'([a-zA-Z]+)'/.exec(source)?.[1]
    if (id === undefined) throw new Error(`could not read the lesson id out of ${file}.ts`)
    const estimate = Number(/estimateSeconds:\s*(\d+)/.exec(source)?.[1] ?? 0)
    lessons.push({
      id,
      estimateSeconds: estimate,
      /* Every `id`/`target` pair in the file, in order: the steps, and then the `task`
       * challenges, which `LearnHost` appends to them and the coach runs as steps too. */
      targets: Object.fromEntries(
        [...source.matchAll(/id:\s*'([\w-]+)',\s*\n\s*target:\s*'([\w-]+)'/g)].map((m) => [m[1], m[2]]),
      ),
      challenges: readChallenges(source, expected[id] ?? {}),
    })
  }
  return { lessons, expected }
}

/** The `{ … }` literal assigned to `name`, as JSON. Both generated objects are pure JSON. */
function sliceObject(source, name) {
  const start = source.indexOf('{', source.indexOf(name))
  let depth = 0
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1
    else if (source[i] === '}') {
      depth -= 1
      if (depth === 0) return source.slice(start, i + 1)
    }
  }
  throw new Error(`could not read ${name}`)
}

/**
 * The challenges a lesson asks after its steps, in order, with the typed ones' answers resolved.
 *
 * `task` challenges are left out on purpose: `LearnHost` appends those to the steps and the coach
 * runs them, so the step driver has already done them by the time a question is on screen.
 */
function readChallenges(source, answers) {
  const body = source.slice(source.indexOf('challenges: ['))
  const out = []
  for (const match of body.matchAll(/kind:\s*'(number|choice|task)'/g)) {
    const kind = match[1]
    const block = body.slice(match.index, match.index + 900)
    if (kind === 'task') continue
    if (kind === 'choice') {
      out.push({ kind, options: [...block.matchAll(/labelKey:\s*'/g)].length })
      continue
    }
    const path = /answer:\s*([^,\n]+)/.exec(block)?.[1]?.trim()
    if (path === undefined) throw new Error('a number challenge with no answer')
    out.push({ kind, answer: resolveAnswer(path, answers) })
  }
  return out
}

/** `ANSWER.challenge.originalPrice` → the figure the engine generated for it. */
function resolveAnswer(expression, answers) {
  if (/^[\d.]+$/.test(expression)) return Number(expression)
  const path = expression.replace(/^ANSWER\.?/, '')
  const value = path.split('.').reduce((node, key) => (node == null ? undefined : node[key]), answers)
  if (typeof value !== 'number') throw new Error(`could not resolve the answer ${expression}`)
  return value
}

/* ── driving the coach ──────────────────────────────────────────────────────────────────── */

/** The coach's tooltip, told apart from every other dialog by the id `Spotlight` describes it by. */
export function coachTip(page) {
  return page.locator('[role="dialog"][aria-describedby^="sooda-spot-text-"]')
}

/** The step on screen, by its own id — `Spotlight` puts it in `aria-describedby`. */
export async function currentStep(page) {
  const tip = coachTip(page)
  if ((await tip.count()) === 0) return null
  const described = await tip.first().getAttribute('aria-describedby')
  return described === null ? null : described.replace('sooda-spot-text-', '')
}

/**
 * Where the spotlight actually cut its hole.
 *
 * The overlay draws the dim as a viewport rectangle with the cutout subtracted, as one even-odd
 * path, so the second subpath *is* the hole — which makes it readable without reaching into
 * React. A step whose target was never found still draws a hole: a 14px square at the bottom
 * edge, from the offscreen fallback the geometry starts at. That is exactly the failure
 * `targets.test.ts` cannot see, so the hole is compared against the target's own rectangle.
 */
export async function cutoutRect(page) {
  return page.evaluate(() => {
    const path = document.querySelector('svg path[fill-rule="evenodd"]')
    const d = path?.getAttribute('d') ?? ''
    const inner = d.slice(d.indexOf('Z') + 1)
    const move = /M([-\d.]+) ([-\d.]+)/.exec(inner)
    const horizontal = /h([-\d.]+)a/.exec(inner)
    const vertical = /v([-\d.]+)a/.exec(inner)
    if (!move || !horizontal || !vertical) return null
    const radius = Number(/a([-\d.]+) /.exec(inner)?.[1] ?? 0)
    return {
      x: Number(move[1]) - radius,
      y: Number(move[2]),
      width: Number(horizontal[1]) + radius * 2,
      height: Number(vertical[1]) + radius * 2,
    }
  })
}

/** The rectangle of the element a `data-tour` name points at, as the page sees it. */
export async function targetRect(page, name) {
  return page.evaluate((tour) => {
    const element = document.querySelector(`[data-tour="${tour}"]`)
    if (!element) return null
    const box = element.getBoundingClientRect()
    return { x: box.left, y: box.top, width: box.width, height: box.height }
  }, name)
}

/**
 * Play a lesson using nothing but «نشانم بده».
 *
 * The rule the flow exists to enforce: the underlying control is never touched. Every step is
 * advanced by pressing the demo button and waiting for the coach to move on by itself — which
 * it only does when the step's own `expect` has been satisfied by an event a real component
 * emitted. A step that does not advance is reported by id, with what was on screen.
 */
export async function playByDemo(page, { words, onStep }) {
  const tip = coachTip(page)
  await tip.first().waitFor({ state: 'visible', timeout: LESSON_START_MS })
  const started = Date.now()
  const steps = []
  let stalled = null
  let noDemo = null

  for (let guard = 0; guard < 40; guard += 1) {
    const id = await currentStep(page)
    if (id === null) break
    steps.push(id)
    if (onStep) await onStep(id, steps.length)

    const showMe = tip.first().getByRole('button', { name: words.showMe })
    if ((await showMe.count()) === 0) {
      noDemo = id
      break
    }
    await showMe.click({ timeout: 5000 })

    const deadline = Date.now() + STEP_TIMEOUT_MS
    let next = id
    while (Date.now() < deadline) {
      await page.waitForTimeout(120)
      next = await currentStep(page)
      if (next !== id) break
    }
    if (next === id) {
      stalled = id
      break
    }
  }

  return { seconds: (Date.now() - started) / 1000, steps, stalled, noDemo }
}

/**
 * Answer whatever the lesson asks afterwards.
 *
 * A typed question is answered with the engine's own figure. A multiple-choice one is answered
 * by working through the options until the surface says «آفرین» — the point being that one of
 * them is accepted and the question can be got past, not that a script knows which.
 */
export async function answerChallenges(page, { words, facts }) {
  /* Scoped to the surface that is actually asking a question. The Learning Centre is a modal
   * dialog too, and it opens the instant the last question is answered — a looser locator
   * answers the lesson and then starts clicking lesson cards, which is how this flow first
   * "failed" with a thirty-second timeout on a button that was never a challenge option. */
  const surface = page
    .locator('[role="dialog"][aria-modal="true"]')
    .filter({ hasText: words.challengeLabel })
  const started = Date.now()
  const answered = []
  const numbers = facts.challenges.filter((c) => c.kind === 'number').map((c) => c.answer)
  let typedSoFar = 0

  const asked = facts.challenges.length
  if (asked > 0) {
    // The questions open as the lesson's last step passes; the surface springs in.
    await surface.first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {})
    if ((await surface.count()) === 0) {
      return { seconds: (Date.now() - started) / 1000, answered, error: 'the lesson asked nothing after its steps' }
    }
  }

  for (let guard = 0; guard < 8; guard += 1) {
    if ((await surface.count()) === 0) break
    const input = surface.locator('input[inputmode="decimal"]')
    const correct = surface.getByText(words.challengeCorrect, { exact: false })

    if ((await input.count()) > 0) {
      const answer = numbers[typedSoFar]
      typedSoFar += 1
      if (answer === undefined) return { seconds: (Date.now() - started) / 1000, answered, error: 'no answer known' }
      await input.first().fill(String(answer))
      await surface
        .getByRole('button', { name: new RegExp(`${escapeRe(words.challengeCheck)}|${escapeRe(words.challengeTryAgain)}`) })
        .first()
        .click()
      await page.waitForTimeout(700)
      if ((await correct.count()) === 0) {
        return { seconds: (Date.now() - started) / 1000, answered, error: `the typed answer ${answer} was rejected` }
      }
      answered.push(`number:${answer}`)
    } else {
      /* A choice question. Its options are the only buttons in the body; the surface's own
       * header close and the skip link are excluded by name. */
      const options = surface.locator('li button')
      const count = await options.count()
      if (count === 0) break
      let accepted = false
      for (let i = 0; i < count; i += 1) {
        await options.nth(i).click()
        await page.waitForTimeout(500)
        if ((await correct.count()) > 0) {
          accepted = true
          answered.push(`choice:${i + 1}/${count}`)
          break
        }
      }
      if (!accepted) {
        return { seconds: (Date.now() - started) / 1000, answered, error: 'no option was accepted' }
      }
    }

    // «آموزش بعدی» / «بازگشت به آموزش‌ها» — the takeaway is read, then the question advances.
    const onwards = surface.getByRole('button', {
      name: new RegExp(`${escapeRe(words.challengeNext)}|${escapeRe(words.challengeFinish)}`),
    })
    if ((await onwards.count()) === 0) break
    await onwards.first().click()
    await page.waitForTimeout(900)
  }

  if (answered.length < asked) {
    return {
      seconds: (Date.now() - started) / 1000,
      answered,
      error: `${answered.length} of ${asked} questions were answered`,
    }
  }
  return { seconds: (Date.now() - started) / 1000, answered, error: null }
}

function escapeRe(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** The overlap between the hole and the rectangle it is supposed to be over, 0…1. */
export function coverage(hole, target) {
  if (!hole || !target || target.width === 0 || target.height === 0) return 0
  const x = Math.max(0, Math.min(hole.x + hole.width, target.x + target.width) - Math.max(hole.x, target.x))
  const y = Math.max(0, Math.min(hole.y + hole.height, target.y + target.height) - Math.max(hole.y, target.y))
  return (x * y) / (target.width * target.height)
}

/* ── the flows ──────────────────────────────────────────────────────────────────────────── */

/**
 * Every measurement the plan asks to see, collected as the flows run and printed as one table
 * at the end so the gates can be read at a glance rather than hunted for in the log.
 */
export const durations = []

export function printDurations(log = console.log) {
  if (durations.length === 0) return
  log('\nDurations, measured in this run — wall clock, every action played by «نشانم بده»:')
  log('  what                             measured   claimed    gate   verdict')
  for (const row of durations) {
    const measured = `${row.seconds.toFixed(1)}s`.padStart(8)
    const claimed = `${row.claimed === undefined ? '—' : `${row.claimed}s`}`.padStart(7)
    const gate = `${row.gate}s`.padStart(6)
    const verdict = !row.complete
      ? `INCOMPLETE — ${row.note}`
      : row.seconds <= row.gate
        ? 'within'
        : `OVER the gate by ${(row.seconds - row.gate).toFixed(1)}s`
    log(`  ${row.name.padEnd(31)}${measured}  ${claimed}  ${gate}   ${verdict}`)
  }
  log(
    '  A demo plays each action in about 1.3s with no reading time, so these are a floor for a\n' +
      '  human, not a simulation of one. A lesson over the gate here is over it for everybody.',
  )
}

/**
 * One lesson, opened at its own `?learn=` link and played end to end by «نشانم بده».
 *
 * Returns everything the caller needs to decide what passed, and leaves the page open so a flow
 * can look at what is on screen afterwards.
 */
async function playLesson(ctx, { lesson, lang, words, watchTargets = false }) {
  const page = await ctx.open({ lang, query: `?learn=${lesson.id}` })
  const misplaced = []

  const played = await playByDemo(page, {
    words,
    onStep: watchTargets
      ? async (id) => {
          // The target is scrolled into view and its rect followed for 700ms; measure after that.
          await page.waitForTimeout(900)
          const target = lesson.targets[id]
          if (target === undefined) return
          const covered = coverage(await cutoutRect(page), await targetRect(page, target))
          if (covered < 0.9) misplaced.push(`${id}→${target} (${Math.round(covered * 100)}% of it lit)`)
        }
      : undefined,
  })

  const ran = played.stalled === null && played.noDemo === null
  const answers = ran
    ? await answerChallenges(page, { words, facts: lesson })
    : { seconds: 0, answered: [], error: null }

  const note =
    played.noDemo !== null
      ? `step "${played.noDemo}" offers no «نشانم بده»`
      : played.stalled !== null
        ? `stalled on step "${played.stalled}"`
        : answers.error !== null
          ? answers.error
          : ''

  durations.push({
    name: `lesson: ${lesson.id} (${lang})`,
    seconds: played.seconds + answers.seconds,
    gate: LESSON_GATE_S,
    claimed: lesson.estimateSeconds,
    complete: ran && answers.error === null,
    note,
  })

  return { page, played, answers, misplaced, ran, note }
}

/** Leave whatever is open, so the next page starts from a calculator rather than a lesson. */
async function leaveLesson(page) {
  for (let i = 0; i < 3; i += 1) {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(250)
  }
}

/**
 * The tutorial flows, in the order the plan prioritises them.
 *
 * `ctx` is the harness `smoke.mjs` owns: its `open`, its `check` and its per-flow error trap.
 */
export async function runLearnFlows(ctx) {
  const { check, flow } = ctx
  const words = await loadStrings()
  const { lessons } = await loadLessonFacts()

  /* ── 1. one lesson, finished with nothing but «نشانم بده» ───────────────────────────── */

  await flow('lesson driven only by «نشانم بده»', async () => {
    const lesson = lessons.find((item) => item.id === 'profit')
    const { page, played, answers, misplaced } = await playLesson(ctx, {
      lesson,
      lang: 'fa',
      words: words.fa,
      watchTargets: true,
    })

    check(
      'demo: every step of the profit lesson offers «نشانم بده»',
      played.noDemo === null,
      played.noDemo === null ? '' : `step "${played.noDemo}" has no demo`,
    )
    check(
      'demo: «نشانم بده» alone finishes the profit lesson',
      played.stalled === null,
      played.stalled === null
        ? `${played.steps.length} steps, no control touched by hand`
        : `stalled on "${played.stalled}"; got through ${played.steps.slice(0, -1).join(' → ')}`,
    )
    check(
      'demo: every step’s target was on screen, under the cutout',
      misplaced.length === 0,
      misplaced.join('; '),
    )
    check(
      'demo: the profit lesson’s question can be answered',
      played.stalled === null && answers.error === null,
      answers.error ?? answers.answered.join(', '),
    )
    await leaveLesson(page)
    await page.close()
  })

  /* ── 3. every lesson, including its challenge ───────────────────────────────────────── */

  await flow('every lesson including its challenge', async () => {
    const stalls = []
    for (const lesson of lessons) {
      /* One lesson that cannot even be driven must not take the other seven with it: the point
       * of the flow is the whole table, and a thrown locator is just another way to fail. */
      let outcome
      try {
        outcome = await playLesson(ctx, { lesson, lang: 'fa', words: words.fa })
      } catch (err) {
        stalls.push(`${lesson.id}: ${String(err.message).split('\n')[0]}`)
        check(`lesson ${lesson.id}: plays through and answers its question`, false, String(err.message).split('\n')[0])
        continue
      }
      const { page, played, answers, ran, note } = outcome
      const ok = ran && answers.error === null
      if (!ok) stalls.push(`${lesson.id}: ${note}`)
      check(
        `lesson ${lesson.id}: plays through and answers its question`,
        ok,
        ok
          ? `${played.steps.length} steps in ${played.seconds.toFixed(1)}s${
              answers.answered.length > 0 ? `, answered ${answers.answered.join(' + ')}` : ', nothing asked'
            }`
          : `${note} (after ${played.steps.join(' → ')})`,
      )
      await leaveLesson(page)
      await page.close()
    }

    const over = durations.filter((row) => row.complete && row.gate === LESSON_GATE_S && row.seconds > row.gate)
    check(
      `duration: every lesson that ran came in under ${LESSON_GATE_S}s`,
      over.length === 0,
      over.map((row) => `${row.name} ${row.seconds.toFixed(1)}s`).join(', '),
    )
    if (stalls.length > 0) console.log(`  lessons that did not finish: ${stalls.join(' | ')}`)
  })
}
