'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react'

/**
 * Arrow button — quiet chevrons like the reference.
 */
export function ArrowButton({
  icon: Icon,
  label,
  onClick,
  style,
}: {
  icon: typeof ChevronLeft
  label: string
  onClick: () => void
  style: React.CSSProperties
}) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'absolute',
        zIndex: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        border: 'none',
        background: 'transparent',
        color: '#656d76',
        opacity: hover ? 0.9 : 0.35,
        transition: 'opacity 150ms ease',
        cursor: 'pointer',
        borderRadius: 6,
        ...style,
      }}
    >
      <Icon size={14} />
    </button>
  )
}

export { ChevronLeft, ChevronRight, ChevronUp, ChevronDown }
