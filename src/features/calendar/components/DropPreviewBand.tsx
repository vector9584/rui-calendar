import type { JSX } from 'react'
import React from 'react'
import { addMinutes, startOfDay } from 'date-fns'
import { formatTime } from '@/lib/datetime'
import type { TimeFormat } from '@/types'
import type { DropPreview } from '../lib/dragSnap'
import styles from './DropPreviewBand.module.css'

interface DropPreviewBandProps {
  preview: DropPreview
  timeFormat: TimeFormat
}

/**
 * Shows exactly where a dragged event will land. Drops resolve to a quarter
 * hour, but the droppable cells are one hour tall, so highlighting the cell
 * itself would overstate where the event goes. This band is positioned on the
 * snapped start instead, and sized to the event's duration.
 *
 * Renders inside a day column's events overlay, which is the same positioning
 * context the event cards use.
 */
export const DropPreviewBand = React.memo(function DropPreviewBand({
  preview,
  timeFormat,
}: DropPreviewBandProps): JSX.Element {
  const { minuteOfDay, durationMinutes } = preview
  const start = addMinutes(startOfDay(new Date()), minuteOfDay)

  return (
    <div
      data-component="drop-preview"
      data-minute-of-day={minuteOfDay}
      className={styles.band}
      style={{
        top: `calc(var(--hour-height, 60px) * ${minuteOfDay / 60})`,
        height: `calc(var(--hour-height, 60px) * ${durationMinutes / 60})`,
      }}
      aria-hidden="true"
    >
      <span className={styles.label}>{formatTime(start, timeFormat)}</span>
    </div>
  )
})
