/**
 * Mission 1 — the minute that decides whether any of the rest gets opened.
 *
 * Onboarding's three cards can say what Sooda is for; only this can show it. «آقا رضا» buys a
 * shawl for 100,000 and wants 20%. Four taps later the same sale is worth under 10%, because
 * three months from now the shawl costs more to replace than it did to buy. That is the whole
 * product in one screen, and it is why the mission ends on the lens rather than on the price.
 *
 * It is not a lesson: no Learning Centre card, no row in the progress map, no challenge. It is
 * five steps and a story card, run by the same coach.
 *
 * WIRING for `ui`: `src/learn/ui/LearnHost.tsx` currently starts Mission 1 as
 * `startLesson('profit', true)`, which runs the seventy-second `profit` lesson instead. Import
 * `loadMission()` from `../lessons` and give the mission path its own branch — its `id` is not a
 * `LessonId`, so the compiler will point at every place that assumed it was, including the two
 * progress writes that must not happen for it.
 */

import { LESSON_INPUTS } from './expected.generated'
import { calculated, chose, committed, filled } from './predicates'
import type { Mission } from './types'

const IN = LESSON_INPUTS.mission

export const MISSION: Mission = {
  id: 'mission',
  storyKey: 'learn.mission.story',
  /* `ui` already renders this: NumberField reads `RepositoryContext.suggestion` and tags the chip
   * `chip-suggest-<field>`, emitting both a change and a commit when it is tapped. All it needs
   * from here is what to offer — and the value has to come from the same place the answer did. */
  suggestion: { field: 'cost', value: IN.cost, labelKey: 'learn.mission.suggestCost' },
  /*
   * Sixty, not the thirty this said while nothing had been timed.
   *
   * There is a scale to measure against, and it is the authors' own: divide each lesson's Persian
   * tooltip words by the seconds it claims, and the eight of them sit between 38 and 56 words a
   * minute — a shopkeeper reading an instruction, finding the control it names, and doing it.
   * The mission's five tooltips are 51 words. At thirty seconds that is 102 words a minute, twice
   * the pace the same authors allowed anyone else, demanded on the one screen whose reader has
   * never seen the app before and has to find «محاسبه کن» for the first time. With the story card
   * and the chip label it reads as 134. Sixty seconds puts it at 51 wpm — the middle of the band
   * — and it is still the shortest thing in the tutorial to *do*: five actions, four of them taps,
   * two digits of typing in total.
   */
  estimateSeconds: 60,
  showsRate: true,
  rateNoteFromStep: 'months',
  /* The same «۳ ماه» step 4 asks for, from the same place its answer came from: the done screen
   * hands the calculator back with the lens where the mission left it. */
  handBackLensMonths: IN.months,
  steps: [
    {
      /* The suggestion chip is the step. A first-run user who has never seen a number field
       * should not have to decide what to put in one — they tap «۱۰۰٬۰۰۰ را وارد کنید» and the
       * mission is already moving. Typing it by hand works exactly as well, which is why the
       * predicate accepts the field arriving at the figure however it got there. */
      id: 'cost',
      target: 'field-cost',
      textKey: 'learn.mission.cost',
      placement: 'bottom',
      before: (ctx) => ctx.navigate({ tab: 'calculator', mode: 'profit' }),
      expect: filled('cost', Number(IN.cost)),
      demo: { actions: [{ target: 'chip-suggest-cost', type: 'tap' }] },
    },
    {
      id: 'margin',
      target: 'field-margin',
      textKey: 'learn.mission.margin',
      placement: 'bottom',
      expect: committed('margin', Number(IN.margin)),
      demo: { actions: [{ target: 'field-margin', type: 'type', value: IN.margin }] },
    },
    {
      id: 'calculate',
      target: 'btn-calculate',
      textKey: 'learn.mission.calculate',
      placement: 'top',
      expect: calculated('profit'),
      demo: { actions: [{ target: 'btn-calculate', type: 'tap' }] },
    },
    {
      /* «پول‌تان کی برمی‌گردد؟» — the month chips are always on screen, so there is nothing to
       * open first; the step points at the row and asks for «۳ ماه». */
      id: 'months',
      target: 'field-months',
      textKey: 'learn.mission.months',
      expect: chose('months', IN.months),
      demo: { actions: [{ target: 'chip-months-3', type: 'tap' }] },
    },
    {
      /* The payoff. A lens chip changes what the card *would* say, not what it says, so the last
       * thing the mission asks for is the second Calculate — and its tooltip is the only place
       * that can promise what is about to appear, because a step's text is read before its act. */
      id: 'again',
      target: 'btn-calculate',
      textKey: 'learn.mission.again',
      placement: 'top',
      expect: calculated('profit'),
      demo: { actions: [{ target: 'btn-calculate', type: 'tap' }] },
    },
  ],
  // Onboarding ends on a badge. A quiz here would be a sixth thing to do inside the minute.
  challenges: [],
}

/** The `loadLesson`-shaped accessor `ui` drives the mission with. */
export function loadMission(): Mission {
  return MISSION
}
