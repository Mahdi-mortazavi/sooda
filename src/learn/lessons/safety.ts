/**
 * Lesson 8 — «روی گوشی خودت»
 *
 * The shortest lesson, and the one that decides whether «آقا رضا» trusts the app with his prices:
 * it installs, it works with the antenna off, the whole shop fits in one file he keeps, and none
 * of it has ever left the phone.
 */

import { REQUESTED_TOUR_ACTIONS } from './actions'
import { opened, tapped } from './predicates'
import type { Lesson } from './types'

export const safetyLesson: Lesson = {
  id: 'safety',
  /* The Learning Centre's card already has a title and a blurb for this lesson, and one
   * lesson does not need two of each — so these point at the catalogue's own keys. */
  titleKey: 'learn.lessons.safety.title',
  summaryKey: 'learn.lessons.safety.body',
  estimateSeconds: 50,
  showsRate: false,
  steps: [
    {
      id: 'settings',
      target: 'btn-settings',
      textKey: 'learn.safety.settings',
      before: (ctx) => ctx.navigate({ tab: 'calculator' }),
      expect: opened('settings'),
      demo: { actions: [{ target: 'btn-settings', type: 'tap' }] },
    },
    {
      /* Install and offline are one idea: on the home screen it opens with no network at all. */
      id: 'install',
      target: 'settings-install',
      textKey: 'learn.safety.install',
      expect: opened('install-guide'),
      demo: { actions: [{ target: 'settings-install', type: 'tap' }] },
    },
    {
      id: 'updates',
      target: 'settings-rates-auto',
      textKey: 'learn.safety.updates',
      before: (ctx) => ctx.navigate({ sheet: 'settings' }),
      expect: tapped(REQUESTED_TOUR_ACTIONS.toggleAutoRates),
      demo: { actions: [{ target: 'btn-rates-auto', type: 'tap' }] },
    },
  ],
  challenges: [
    {
      kind: 'task',
      id: 'backup',
      promptKey: 'learn.safety.challenge.backup',
      hintKey: 'learn.safety.challenge.backup.hint',
      target: 'settings-backup',
      before: (ctx) => ctx.navigate({ sheet: 'settings' }),
      /* The practice shop's own exporter runs here, so the file the learner is handed holds the
       * demo rice and nothing of their own — which is the point of taking the backup in a lesson. */
      done: tapped('backup'),
      demo: { actions: [{ target: 'btn-backup-export', type: 'tap' }] },
    },
    {
      kind: 'choice',
      id: 'where',
      promptKey: 'learn.safety.challenge.where.prompt',
      hintKey: 'learn.safety.challenge.where.hint',
      /* Not an engine answer — a fact about the app. It is the one question in the whole set whose
       * correctness is a property of the product rather than of a calculation. */
      options: [
        { id: 'phone', labelKey: 'learn.safety.challenge.where.phone', correct: true },
        { id: 'servers', labelKey: 'learn.safety.challenge.where.servers', correct: false },
        { id: 'account', labelKey: 'learn.safety.challenge.where.account', correct: false },
      ],
    },
  ],
}
