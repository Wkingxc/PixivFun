export interface PointerPosition {
  x: number
  y: number
}

const MAX_CLICK_MOVEMENT = 5

export function shouldNavigateArtworkTag(
  start: PointerPosition | null,
  end: PointerPosition | null,
  selectedText: string
): boolean {
  if (selectedText.trim()) return false
  if (!start || !end) return true

  return Math.hypot(end.x - start.x, end.y - start.y) <= MAX_CLICK_MOVEMENT
}
