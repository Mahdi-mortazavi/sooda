/**
 * The questions that turn «تمام شد» into «قبول».
 *
 * A lesson the shopkeeper watched is `done`; a lesson whose challenge they answered is `passed`,
 * and only `passed` counts towards «استاد سودا». That distinction is the whole reason the badge
 * means anything, so the questions are asked for real: the answers come from the engine
 * (`expected.generated.ts`), never from an author's arithmetic.
 *
 * Only the typed and the multiple-choice questions are drawn here. A `task` challenge is «do it
 * in the practice shop», which is exactly what a step is — `LearnHost` appends those to the
 * lesson's steps and lets the coach judge them, rather than building a second runner for them.
 *
 * Retries are free. The point is that they end up knowing the answer, not that we catch them out;
 * what is not free is skipping, which leaves the lesson `done`.
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
  /** Every question answered correctly — the lesson is `passed`. */
  onPassed: () => void
  /** Closed early. The lesson stays `done`: they did it, they just did not answer. */
  onSkip: () => void
}

export function Challenges({ open, lang, title, challenges, onPassed, onSkip }: ChallengesProps) {
  const { t } = useTranslation()
  const reducedMotion = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [typed, setTyped] = useState('')
  const [wrong, setWrong] = useState(false)

  const challenge = challenges[index]
  if (!challenge) return null

  const advance = () => {
    vibrate()
    setWrong(false)
    setTyped('')
    if (index + 1 >= challenges.length) onPassed()
    else setIndex(index + 1)
  }

  const reject = () => {
    vibrate()
    setWrong(true)
  }

  const counter = t('learn.stepOf', {
    defaultValue: '{{current}} / {{total}}',
    replace: {
      current: formatNumber(index + 1, lang, 0),
      total: formatNumber(challenges.length, lang, 0),
    },
  })

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
        {`${counter}. ${t(challenge.promptKey)}`}
      </p>

      <div className="glass glass-ring rounded-3xl px-5 py-5">
        <p className="text-[16px] font-semibold leading-relaxed">{t(challenge.promptKey)}</p>
      </div>

      {challenge.kind === 'choice' ? (
        <ul className="mt-4 flex flex-col gap-2.5">
          {challenge.options.map((option) => (
            <li key={option.id}>
              <motion.button
                type="button"
                whileTap={reducedMotion ? undefined : { scale: 0.98 }}
                onClick={() => (option.correct ? advance() : reject())}
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
              label={t(
                challenge.unit === 'percent' ? 'learn.yourAnswerPercent' : 'learn.yourAnswer',
                { defaultValue: 'Your answer' },
              )}
              value={typed}
              onChange={(next) => {
                setTyped(next)
                setWrong(false)
              }}
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
              if (Number.isFinite(parsed) && Math.abs(parsed - challenge.answer) <= challenge.tolerance) advance()
              else reject()
            }}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent-fill-strong)] px-4 py-3.5 text-[16px] font-bold text-white dark:text-[hsl(168_90%_8%)]"
          >
            <IconCheck size={18} />
            {t('learn.checkAnswer', { defaultValue: 'Check' })}
          </motion.button>
        </>
      ) : null}

      <p role="status" className="mt-3 min-h-[20px] px-1 text-[13.5px] font-semibold text-loss-600 dark:text-loss-400">
        {wrong ? t('learn.tryAgain', { defaultValue: 'Not quite — have another go.' }) : ''}
      </p>

      <button
        type="button"
        onClick={onSkip}
        className="mt-2 w-full rounded-full py-3 text-[14px] font-semibold text-[var(--text-secondary)]"
      >
        {t('learn.skip', { defaultValue: 'Skip' })}
      </button>
    </LearnSurface>
  )
}
