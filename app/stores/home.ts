import { defineStore } from 'pinia'
import type { ArtworkInfo, RankedArtworkInfo } from '~/types'
import { safeRankingCandidates } from '~/utils/refineModernArtwork'

export const useHomeStore = defineStore('home', () => {
  const pixivClient = usePixivClient()
  const randomBg = ref<ArtworkInfo | null>(null)

  const rankingList = ref<RankedArtworkInfo[]>([])
  const rankingCandidates = ref<RankedArtworkInfo[]>([])
  const loadingRanking = ref(false)
  let rankingRequest: Promise<void> | null = null

  const followingList = ref<ArtworkInfo[]>([])
  const loadingFollowing = ref(false)

  async function fetchRandomBg(): Promise<void> {
    if (!rankingCandidates.value.length) await fetchRanking()
    const available = rankingCandidates.value.filter(
      (artwork) =>
        rankingCandidates.value.length === 1 ||
        artwork.id !== randomBg.value?.id
    )
    if (!available.length) return
    randomBg.value = available[Math.floor(Math.random() * available.length)]!
  }

  async function fetchRanking(): Promise<void> {
    if (rankingRequest) return rankingRequest
    rankingRequest = (async () => {
      try {
        loadingRanking.value = true
        const data = await pixivClient.getRanking({
          mode: 'daily',
          content: 'all',
          p: 1,
        })
        rankingCandidates.value = safeRankingCandidates(data.contents, 10)
        rankingList.value = rankingCandidates.value.slice(0, 5)
        if (!randomBg.value && rankingCandidates.value.length) {
          await fetchRandomBg()
        }
      } catch (err) {
        console.error('Failed to fetch ranking', err)
      } finally {
        loadingRanking.value = false
        rankingRequest = null
      }
    })()
    return rankingRequest
  }

  async function fetchFollowing(): Promise<void> {
    if (loadingFollowing.value) return
    try {
      loadingFollowing.value = true
      const data = await pixivClient.getFollowLatest({ p: 1, mode: 'all' })
      followingList.value = data.thumbnails.illust
    } catch (err) {
      console.error('Failed to fetch following', err)
    } finally {
      loadingFollowing.value = false
    }
  }

  return {
    randomBg,
    fetchRandomBg,
    rankingList,
    rankingCandidates,
    loadingRanking,
    fetchRanking,
    followingList,
    loadingFollowing,
    fetchFollowing,
  }
})
