import { onScopeDispose, watch, type Ref } from 'vue'

interface BodyLockSnapshot {
  overflow: string
  paddingRight: string
}

let activeBodyLocks = 0
let bodyLockSnapshot: BodyLockSnapshot | null = null

function acquireBodyLock() {
  if (typeof document === 'undefined') return
  activeBodyLocks += 1
  if (activeBodyLocks > 1) return

  const body = document.body
  bodyLockSnapshot = {
    overflow: body.style.overflow,
    paddingRight: body.style.paddingRight,
  }

  const scrollbarWidth = Math.max(
    0,
    window.innerWidth - document.documentElement.clientWidth
  )
  const currentPadding = Number.parseFloat(
    window.getComputedStyle(body).paddingRight
  )
  body.style.overflow = 'hidden'
  if (scrollbarWidth > 0) {
    body.style.paddingRight = `${(Number.isFinite(currentPadding) ? currentPadding : 0) + scrollbarWidth}px`
  }
}

function releaseBodyLock() {
  if (typeof document === 'undefined' || activeBodyLocks === 0) return
  activeBodyLocks -= 1
  if (activeBodyLocks > 0) return

  const body = document.body
  body.style.overflow = bodyLockSnapshot?.overflow ?? ''
  body.style.paddingRight = bodyLockSnapshot?.paddingRight ?? ''
  bodyLockSnapshot = null
}

export function useBodyScrollLock(isLocked: Ref<boolean>) {
  let ownsLock = false
  const stop = watch(
    isLocked,
    (locked) => {
      if (locked && !ownsLock) {
        acquireBodyLock()
        ownsLock = true
      } else if (!locked && ownsLock) {
        releaseBodyLock()
        ownsLock = false
      }
    },
    { immediate: true }
  )

  onScopeDispose(() => {
    stop()
    if (ownsLock) releaseBodyLock()
  })
}
