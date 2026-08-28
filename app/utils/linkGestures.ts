/**
 * True for pointer gestures that open a link in another tab or window instead
 * of navigating the current page: middle click, and primary click with a
 * ctrl / cmd / shift modifier.
 *
 * These gestures leave the current page mounted, so anything the destination
 * page would have updated (a visited marker, for instance) has to be applied
 * here or the card stays stale until a reload.
 */
export function isOpenInNewViewGesture(event: MouseEvent): boolean {
  if (event.button === 1) return true
  return (
    event.button === 0 && (event.ctrlKey || event.metaKey || event.shiftKey)
  )
}

/** True for every pointer gesture that can navigate to an artwork. */
export function shouldRecordArtworkVisitGesture(event: MouseEvent): boolean {
  return (event.button === 0 && !event.altKey) || isOpenInNewViewGesture(event)
}
