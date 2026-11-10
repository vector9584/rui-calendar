import { WINDOW_MIN_HEIGHT, WINDOW_MIN_WIDTH } from './schema'
import type { Bounds } from './schema'

type WorkArea = { x: number; y: number; width: number; height: number }
const SNAP_DISTANCE = 12

export function visibleBounds(bounds: Bounds | null, areas: readonly WorkArea[]): Bounds {
  const primary = areas[0] ?? { x: 0, y: 0, width: 1920, height: 1080 }
  const original = bounds ?? { x: primary.x + 24, y: primary.y + 24, width: 400, height: 680 }
  const area = areas.find((candidate) =>
    original.x < candidate.x + candidate.width && original.x + original.width > candidate.x &&
    original.y < candidate.y + candidate.height && original.y + original.height > candidate.y,
  ) ?? primary
  const width = Math.min(Math.max(original.width, WINDOW_MIN_WIDTH), area.width)
  const height = Math.min(Math.max(original.height, WINDOW_MIN_HEIGHT), area.height)
  return {
    width, height,
    x: Math.round(Math.min(Math.max(original.x, area.x), area.x + area.width - width)),
    y: Math.round(Math.min(Math.max(original.y, area.y), area.y + area.height - height)),
  }
}

export function snapBounds(bounds: Bounds, area: WorkArea): Bounds {
  let { x, y } = bounds
  if (Math.abs(x - area.x) <= SNAP_DISTANCE) x = area.x
  if (Math.abs(y - area.y) <= SNAP_DISTANCE) y = area.y
  if (Math.abs(x + bounds.width - area.x - area.width) <= SNAP_DISTANCE) x = area.x + area.width - bounds.width
  if (Math.abs(y + bounds.height - area.y - area.height) <= SNAP_DISTANCE) y = area.y + area.height - bounds.height
  return { ...bounds, x, y }
}
