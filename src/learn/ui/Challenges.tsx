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
  /**
   * The questions are behind them. `passed` is false if any answer was shown to them rather than
   * given by them, which is what keeps «استاد سودا» meaning every question was actually answered.
   */
  onDone: (passed: boolean) => void
  /** Closed early. The lesson stays `done`: they did it, they just did not answer. */
  onSkip: () => void
}

export function Challenges({
  open,
  lang,
  title,
  challenges,
  summaryKey,
  onDone,
  onSkip,
}: ChallengesProps) {
  const { t } = useTranslation()
  const reducedMotion = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [typed, setTyped] = useState('')
  const [misses, setMisses] = useState(0)
  /*
   * Where the current question is.
   *
   * `asking` until it is settled; then it pauses on the takeaway rather than skipping straight
   * on, because "here is what you learned" is the only place a lesson says out loud what it was
   * for. `shown` is the same pause reached by «نشانم بده» instead of by answering.
   */
  const [phase, setPhase] = useState<'asking' | 'answered' | 'shown'>('asking')
  /* Sticky for the whole run: one answer handed over is the difference between a lesson finished
   * and a lesson passed, and moving on to the next question must not quietly forget it. */
  const [anyShown, setAnyShown] = useState(false)

  const challenge = challenges[index]
  if (!challenge) return null

  /* Most questions taught what the lesson taught. One does not: a binary option standing in for
   * a three-state answer needs the nuance said after the answer is in, rather than folded into
   * an option that would then be visibly longer than the wrong one. */
  const takeawayKey = challenge.takeawayKey ?? summaryKey

  const last = index + 1 >= challenges.length

  const accept = () => {
    vibrate()
    setPhase('answered')
  }

  /**
   * «نشانم بده» — the way out of being stuck that is not another wrong answer.
   *
   * It settles the question the same way a right answer does, and the learner reads the same
   * takeaway. What it does not do is count: being shown an answer is finishing the lesson, not
   * answering it, so the lesson lands on `done` and «استاد سودا» keeps its meaning. Nothing here
   * says "wrong" — they asked for help and got it.
   */
  const reveal = () => {
    vibrate()
    setAnyShown(true)
    setPhase('shown')
  }

  const advance = () => {
    vibrate()
    setPhase('asking')
    setMisses(0)
    setTyped('')
    if (last) onDone(!anyShown)
    else setIndex(index + 1)
  }

  const reject = () => {
    vibrate()
    setMisses((n) => n + 1)
  }

  /*
   * The lesson's own hint for this challenge.
   *
   * `learn.challenge.hintMore` is a label — "another hint" — and on its own it is not a hint at
   * all, which is what a second miss used to get. Every challenge now carries a `hintKey`; the
   * fallback is kept only so that one added without a hint degrades to the old label rather than
   * to a raw key.
   */
  const hintKey = challenge.hintKey ?? 'learn.challenge.hintMore'

  /*
   * What «نشانم بده» actually shows.
   *
   * Someone who has missed twice has one of two problems — a wrong mental model, or arithmetic —
   * and the takeaway only addresses the first. Without the figure they cannot tell which one they
   * had: «آن ۲۵٪ روی قیمت خرید سوار می‌شود» and still no idea it was ۱۸۸٬۰۰۰.
   *
   * Formatted the way the question asked for it: a bare number where the field had no unit, and
   * a percent where it did, so what they read back matches what they were typing.
   */
  const revealed: { text: string; numeric: boolean } | null =
    challenge.kind === 'number'
      ? {
          text: `${formatNumber(challenge.answer, lang)}${challenge.unit === 'percent' ? t('fields.percentUnit') : ''}`,
          numeric: true,
        }
      : challenge.kind === 'choice'
        ? (() => {
            const right = challenge.options.find((option) => option.correct)
            return right === undefined ? null : { text: t(right.labelKey), numeric: false }
          })()
        : null

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
        {phase === 'answered'
          ? `${t('learn.challenge.correct')} ${t(takeawayKey)}`
          : phase === 'shown'
            ? `${t('learn.challenge.theAnswer')} ${revealed?.text ?? ''}. ${t(takeawayKey)}`
            : `${counter}. ${prompt}`}
      </p>

      <p className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
        {t('learn.challenge.label')}
      </p>
      <div className="glass glass-ring rounded-3xl px-5 py-5">
        <p className="text-[16px] font-semibold leading-relaxed">{prompt}</p>
      </div>

      {phase !== 'asking' ? (
        <motion.section
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          aria-label={t('learn.challenge.takeawayLabel')}
          className="mt-4"
        >
          {/* Only an answer they gave gets «آفرین». A revealed one goes straight to the takeaway:
            * congratulating someone on an answer they asked to be shown is the kind of praise
            * that teaches a learner not to trust the next one. */}
          {phase === 'answered' ? (
            <p className="flex items-center gap-2 px-1 text-[15px] font-bold text-[var(--accent-text)]">
              <IconCheck size={18} />
              {t('learn.challenge.correct')}
            </p>
          ) : null}
          {phase === 'shown' && revealed !== null ? (
            <div className="glass glass-ring rounded-2xl px-4 py-3.5">
              <p className="text-[12.5px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                {t('learn.challenge.theAnswer')}
              </p>
              {/* A figure reads left-to-right in Persian too, and `tabular-nums` keeps it from
                * jittering against the question above it. A chosen option is ordinary prose. */}
              <p
                {...(revealed.numeric ? { dir: 'ltr' } : {})}
                className={`mt-1 text-[20px] font-bold leading-snug ${
                  revealed.numeric ? `tabular-nums ${lang === 'fa' ? 'text-end' : 'text-start'}` : ''
                }`}
              >
                {revealed.text}
              </p>
            </div>
          ) : null}
          {/* There is always something above it — the «آفرین» line or the figure — except in the
            * one case a challenge has no answer to show, and then it sits on its own. */}
          <div className={`glass glass-ring rounded-2xl px-4 py-3.5 ${revealed === null && phase !== 'answered' ? '' : 'mt-3'}`}>
            <p className="text-[12.5px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
              {t('learn.challenge.takeawayLabel')}
            </p>
            <p className="mt-1 text-[15px] leading-relaxed">{t(takeawayKey)}</p>
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
                {/* After a miss the button acknowledges the retry rather than repeating the
                  * first-time label — «یک‌بار دیگر امتحان کنید», not «جواب را بررسی کن» again. */}
                {t(misses === 0 ? 'learn.challenge.check' : 'learn.challenge.tryAgain')}
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
              /*
               * Words only, and deliberately: there is nothing on screen left to point at.
               * `finishLesson` tears the practice shop down before the question is asked, so by
               * now the app is back on the shopkeeper's own data — a ring around `result-card`
               * would be circling their real result, or nothing at all. `Challenge.target` is for
               * the `task` challenges, which the coach runs as steps while practice is still up.
               */
              <div className="glass glass-ring rounded-2xl px-4 py-3">
                <p className="text-[12.5px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                  {t('learn.challenge.hint')}
                </p>
                <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
                  {t(hintKey)}
                </p>
                {/* The way out of being stuck that is not another wrong answer. Two misses is
                  * where a learner starts guessing, and a question with no exit but a guess is a
                  * question that teaches nothing. */}
                <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
                  {t('learn.challenge.showMeOffer')}
                </p>
                <button
                  type="button"
                  onClick={reveal}
                  className="mt-2 rounded-full bg-accent-500/16 px-3.5 py-1.5 text-[13px] font-bold text-[var(--accent-text)]"
                >
                  {t('learn.challenge.showMe')}
                </button>
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
