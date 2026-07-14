import { animate, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

interface CountUpProps {
  value: number
  format: (value: number) => string
}

/** Spring-animated number that counts from the previous value to the new one. */
export function CountUp({ value, format }: CountUpProps) {
  const [display, setDisplay] = useState(value)
  const previous = useRef(0)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    const from = previous.current
    previous.current = value
    if (reducedMotion || from === value) {
      setDisplay(value)
      return
    }
    const controls = animate(from, value, {
      type: 'spring',
      stiffness: 210,
      damping: 30,
      onUpdate: (v) => setDisplay(v),
      onComplete: () => setDisplay(value),
    })
    return () => controls.stop()
  }, [value, reducedMotion])

  // The animated frames are decorative; screen readers get the final value from the
  // aria-live region rendered by the parent.
  return <span aria-hidden>{format(display)}</span>
}
