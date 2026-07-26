import { PixivApiBase, type PixivResponse } from './base'
import type { Comments } from '~/types'

export class CommentApi extends PixivApiBase {
  async getComments(
    illustId: string,
    params: { limit: number; offset: number }
  ): Promise<{ hasNext: boolean; comments: Comments[] }> {
    const { data } = await this.http.get<
      PixivResponse<{ hasNext: boolean; comments: Comments[] }>
    >('/ajax/illusts/comments/roots', {
      params: {
        illust_id: illustId,
        limit: String(params.limit),
        offset: String(params.offset),
      },
    })
    return this.unwrap(data)
  }

  async getNovelComments(
    novelId: string,
    params: { limit: number; offset: number }
  ): Promise<{ hasNext: boolean; comments: Comments[] }> {
    const { data } = await this.http.get<
      PixivResponse<{ hasNext: boolean; comments: Comments[] }>
    >('/ajax/novels/comments/roots', {
      params: {
        novel_id: novelId,
        limit: String(params.limit),
        offset: String(params.offset),
      },
    })
    return this.unwrap(data)
  }

  /** Load replies for a root comment (replies are always one level deep). */
  async getCommentReplies(
    commentId: string,
    page: number,
    type: 'illust' | 'novel' = 'illust'
  ): Promise<{ hasNext: boolean; comments: Comments[] }> {
    const endpoint =
      type === 'novel'
        ? '/ajax/novels/comments/replies'
        : '/ajax/illusts/comments/replies'
    const { data } = await this.http.get<
      PixivResponse<{ hasNext: boolean; comments: Comments[] }>
    >(endpoint, {
      params: { comment_id: commentId, page: String(page) },
    })
    return this.unwrap(data)
  }

  async postComment(params: {
    illustId: string | number
    authorUserId: string | number
    comment: string
  }): Promise<any> {
    const { data } = await this.http.post<PixivResponse<any>>(
      '/ajax/illusts/comments/post',
      {
        type: 'comment',
        illust_id: params.illustId,
        author_user_id: params.authorUserId,
        comment: params.comment,
      }
    )
    return this.unwrap(data)
  }
}
