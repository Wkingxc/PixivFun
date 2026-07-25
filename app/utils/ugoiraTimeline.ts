export interface UgoiraTimelineFrame {
  delay: number
}

export function getUgoiraDuration(frames: UgoiraTimelineFrame[]): number {
  return frames.reduce((total, frame) => total + Math.max(0, frame.delay), 0)
}

export function getUgoiraPlaybackProgress(
  frames: UgoiraTimelineFrame[],
  frameIndex: number
): number {
  const duration = getUgoiraDuration(frames)
  if (!duration || !frames.length) return 0
  const safeIndex = Math.min(Math.max(0, frameIndex), frames.length - 1)
  const elapsed = frames
    .slice(0, safeIndex)
    .reduce((total, frame) => total + Math.max(0, frame.delay), 0)
  return (elapsed / duration) * 100
}

export function getUgoiraFrameIndexAtProgress(
  frames: UgoiraTimelineFrame[],
  progress: number
): number {
  if (!frames.length) return 0
  const duration = getUgoiraDuration(frames)
  if (!duration) return 0
  const target = (Math.min(100, Math.max(0, progress)) / 100) * duration
  let elapsed = 0

  for (let index = 0; index < frames.length; index += 1) {
    elapsed += Math.max(0, frames[index]!.delay)
    if (target < elapsed) return index
  }

  return frames.length - 1
}
