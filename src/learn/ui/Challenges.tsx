/**
 * The questions that turn «تمام شد» into «قبول».
 *
 * A lesson the shopkeeper watched is `done`; a lesson whose challenge they answered is `passed`,
 * and only `passed` counts towards «استاد سودا». That distinction is the whole reason the badge
 * means anything, so the questions are asked for real: the answers come from the engine
 * (`expected.generated.ts`), never from an author's arithmetic.
 *
 * The rule that shapes everything below is the brief's: **no guilt**. A wrong answer is never
 * corrected and never shown the right figure. The first miss says only "not yet"; the second
 * offers a hint — which points at *where* the answer is, not at what it is — and then offers to
 * show them. Retries are free. The point is that they end up knowing, not that we catch them out.
 *
 * Only the typed and the multiple-choice questions are drawn here. A `task` challenge is «do it
 * in the practice shop», which is exactly what a step is — `LearnHost` appends those to the
 * lesson's steps and lets the coach judge them, rather than building a second runner for them.
 */

import { motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import '../../i18n/sheets'
import { IconCheck } from '../../components/Icons'
import { NumberField } from '../../components/NumberField'
import { vibrate } from '../../lib/haptics'
import { formatNumber, parseAmount, type AppLanguage } from '../../lib/numbers'
import type { Challenge } from '../lessons/types'
import { LearnSurface } from './Surface'

interface ChallengesProps {
  open: boolean
  lang: AppLanguage
  title: string
  /** Already filtered to the asked kinds; `LearnHost` sends the `task` ones to the coach. */
  challenges: Challenge[]
  /** The lesson's own one-line summary — «این را یاد گرفتید» is shown against it. */
  summaryKey: string
  /** Spotlights the step a challenge points at, for the second miss. Absent when it has no target. */
  onShowMe?: ((target: string) => void) | undefined
  /** Every question answered — the lesson is `passed`. */
  onPassed: () => void
  /** Closed early. The lesson stays `done`: they did it, they just did not answer. */
  onSkip: () => void
}

export function Challenges({
  open,
  lang,
  title,
  challenges,
  summaryKey,
  onShowMe,
  onPassed,
  onSkip,
}: ChallengesProps) {
  const { t } = useTranslation()
  const reducedMotion = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [typed, setTyped] = useState('')
  const [misses, setMisses] = useState(0)
  /* Right answers pause on the takeaway rather than skipping straight on: "here is what you
   * learned" is the only place a lesson says out loud what it was for. */
  const [correct, setCorrect] = useState(false)

  const challenge = challenges[index]
  if (!challenge) return null

  const last = index + 1 >= challenges.length

  const accept = () => {
    vibrate()
    setCorrect(true)
  }

  const advance = () => {
    vibrate()
    setCorrect(false)
    setMisses(0)
    setTyped('')
    if (last) onPassed()
    else setIndex(index + 1)
  }

  const reject = () => {
    vibrate()
    setMisses((n) => n + 1)
  }

  const counter = t('learn.stepOf', {
    defaultValue: '{{current}} / {{total}}',
    replace: {
      current: formatNumber(index + 1, lang, 0),
      total: formatNumber(challenges.length, lang, 0),
    },
  })
  const prompt = t(challenge.promptKey)

  return (
    <LearnSurface
      open={open}
      onClose={onSkip}
      title={title}
      aside={
        <span aria-hidden className="shrink-0 text-[13px] font-semibold tabular-nums text-[var(--text-tertiary)]">
          {counter}
        </span>
      }
    >
      <p className="sr-only" aria-live="polite">
        {correct ? `${t('learn.challenge.correct')} ${t(summaryKey)}` : `${counter}. ${prompt}`}
      </p>

      <p className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
        {t('learn.challenge.label')}
      </p>
      <div className="glass glass-ring rounded-3xl px-5 py-5">
        <p className="text-[16px] font-semibold leading-relaxed">{prompt}</p>
      </div>

      {correct ? (
        <motion.section
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          aria-label={t('learn.challenge.correct')}
          className="mt-4"
        >
          <p className="flex items-center gap-2 px-1 text-[15px] font-bold text-[var(--accent-text)]">
            <IconCheck size={18} />
            {t('learn.challenge.correct')}
          </p>
          <div className="glass glass-ring mt-3 rounded-2xl px-4 py-3.5">
            <p className="text-[12.5px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
              {t('learn.challenge.takeawayLabel')}
            </p>
            <p className="mt-1 text-[15px] leading-relaxed">{t(summaryKey)}</p>
          </div>
          <motion.button
            type="button"
            whileTap={reducedMotion ? undefined : { scale: 0.97 }}
            onClick={advance}
            className="mt-4 w-full rounded-full bg-[var(--accent-fill-strong)] py-4 text-[17px] font-bold text-white dark:text-[hsl(168_90%_8%)]"
          >
            {last ? t('learn.challenge.finish') : t('learn.challenge.next')}
          </motion.button>
        </motion.section>
      ) : (
        <>
          {challenge.kind === 'choice' ? (
            <ul className="mt-4 flex flex-col gap-2.5">
              {challenge.options.map((option) => (
                <li key={option.id}>
                  <motion.button
                    type="button"
                    whileTap={reducedMotion ? undefined : { scale: 0.98 }}
                    onClick={() => (option.correct ? accept() : reject())}
                    className="glass glass-ring w-full rounded-2xl px-4 py-3.5 text-start text-[15px] font-semibold"
                  >
                    {t(option.labelKey)}
                  </motion.button>
                </li>
              ))}
            </ul>
          ) : null}

          {challenge.kind === 'number' ? (
            <>
              <div className="glass glass-ring mt-4 rounded-3xl">
                <NumberField
                  id="learn-challenge"
                  label={t('learn.challenge.answerLabel')}
                  value={typed}
                  onChange={setTyped}
                  placeholder={
                    challenge.unit === 'percent' ? t('fields.percentPlaceholder') : t('fields.amountPlaceholder')
                  }
                  lang={lang}
                  {...(challenge.unit === 'percent' ? { unit: t('fields.percentUnit') } : {})}
                />
              </div>
              <motion.button
                type="button"
                whileTap={reducedMotion ? undefined : { scale: 0.97 }}
                onClick={() => {
                  const parsed = parseAmount(typed)
                  /* Tolerance is the lesson's, from the engine — never a fudge that lets a wrong
                   * answer through. A blank or non-numeric entry is simply not an answer. */
                  if (Number.isFinite(parsed) && Math.abs(parsed - challenge.answer) <= challenge.tolerance) accept()
                  else reject()
                }}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent-fill-strong)] px-4 py-3.5 text-[16px] font-bold text-white dark:text-[hsl(168_90%_8%)]"
              >
                <IconCheck size={18} />
                {t('learn.challenge.check')}
              </motion.button>
            </>
          ) : null}

          <div role="status" aria-live="polite" className="mt-3 min-h-[20px]">
            {misses === 1 ? (
              /* First miss: no correction, no right answer, no "wrong". They try again. */
              <p className="px-1 text-[13.5px] font-semibold text-[var(--text-secondary)]">
                {t('learn.challenge.incorrect')}
              </p>
            ) : null}
            {misses >= 2 ? (
              <div className="glass glass-ring rounded-2xl px-4 py-3">
                <p className="text-[12.5px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                  {t('learn.challenge.hint')}
                </p>
                <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
                  {t('learn.challenge.hintMore')}
                </p>
                {onShowMe !== undefined && challenge.target !== undefined ? (
                  <>
                    <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
                      {t('learn.challenge.showMeOffer')}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        vibrate()
                        /* Points at where the answer is. It never types anything: practice is over
                         * by now, and a demo that drove the real calculator would be writing to the
                         * shopkeeper's own app in the middle of a question. */
                        onShowMe(challenge.target as string)
                      }}
                      className="mt-2 rounded-full bg-accent-500/16 px-3.5 py-1.5 text-[13px] font-bold text-[var(--accent-text)]"
                    >
                      {t('learn.challenge.showMe')}
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        </>
      )}

      <button
        type="button"
        onClick={onSkip}
        className="mt-3 w-full rounded-full py-3 text-[14px] font-semibold text-[var(--text-secondary)]"
      >
        {t('learn.skip')}
      </button>
    </LearnSurface>
  )
}
