// Rest countdown docked above the tab bar. Restarts whenever runId changes.
import { useEffect, useState } from 'react'

export interface RestTimerProps {
  runId: number
  seconds?: number
  onDone: () => void
}

export default function RestTimer({ runId, seconds = 90, onDone }: RestTimerProps) {
  const [left, setLeft] = useState(seconds)
  const [total, setTotal] = useState(seconds)

  useEffect(() => {
    setLeft(seconds)
    setTotal(seconds)
  }, [runId, seconds])

  useEffect(() => {
    const t = setInterval(() => {
      setLeft((v) => {
        if (v <= 1) {
          clearInterval(t)
          return 0
        }
        return v - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [runId, total])

  useEffect(() => {
    if (left === 0) onDone()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left])

  const pct = total > 0 ? (left / total) * 100 : 0
  const mm = Math.floor(left / 60)
  const ss = String(left % 60).padStart(2, '0')

  return (
    <div className="log-rest" role="timer" aria-label="Rest timer">
      <span
        className="log-rest-ring num"
        style={{ background: `conic-gradient(var(--accent) ${pct}%, var(--surface-3) 0)` }}
      >
        <span className="log-rest-time">{mm}:{ss}</span>
      </span>
      <span className="log-rest-label">Rest</span>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => {
          setLeft((v) => v + 30)
          setTotal((t) => t + 30)
        }}
      >
        +30s
      </button>
      <button className="btn btn-ghost btn-sm" onClick={onDone}>
        Skip
      </button>
    </div>
  )
}
