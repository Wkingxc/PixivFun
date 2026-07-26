import { PixivApiBase } from './base'
import { applyMixins } from '~/utils/applyMixins'
import { ArtworkApi } from './artwork'
import { NovelApi } from './novel'
import { SearchApi } from './search'
import { UserApi } from './user'
import { BookmarkApi } from './bookmark'
import { CommentApi } from './comment'

export type { PixivWebClientOptions } from './base'
export type { UgoiraMeta, RecommendResult } from './artwork'
export type { FollowingResult } from './user'

// ── PixivWebClient ───────────────────────────────────────────────────
// Aggregates the per-domain API mixins into the single flat client the
// rest of the app consumes. All mixins share PixivApiBase, so state
// (http instance, pximg replacer) is initialized once here.

export class PixivWebClient extends PixivApiBase {}

export interface PixivWebClient
  extends ArtworkApi, NovelApi, SearchApi, UserApi, BookmarkApi, CommentApi {}

applyMixins(PixivWebClient, [
  ArtworkApi,
  NovelApi,
  SearchApi,
  UserApi,
  BookmarkApi,
  CommentApi,
])
