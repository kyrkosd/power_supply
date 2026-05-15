import React, { useState, useRef, useEffect } from 'react'
import styles from './Tooltip.module.css'

interface TooltipProps {
  children: React.ReactNode
  content: React.ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
}

/**
 * Reusable tooltip component. Wraps the children and shows tooltip on hover.
 * Usage:
 *   <Tooltip content="Your hint here">
 *     <span>Hover me</span>
 *   </Tooltip>
 */
export function Tooltip({
  children,
  content,
  side = 'top',
  delay = 200,
}: TooltipProps): React.ReactElement {
  const [isVisible, setIsVisible] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true)
    }, delay)
  }

  const hideTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setIsVisible(false)
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return (
    <div
      ref={wrapperRef}
      className={styles.wrapper}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
    >
      {children}
      {isVisible && (
        <div className={`${styles.tooltip} ${styles[side]}`}>
          {content}
        </div>
      )}
    </div>
  )
}
