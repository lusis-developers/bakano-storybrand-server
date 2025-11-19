import "dotenv/config"
import CustomError from "../errors/customError.error"
import { HttpStatusCode } from "axios"
import { ApifyClient } from "apify-client"

class ScrapperService {
  private client: any
  private token: string

  constructor(token?: string) {
    this.client = null
    this.token = token || process.env.APIFY_API_KEY || ""
  }

  private async ensureClient(): Promise<void> {
    if (this.client) return
    if (!this.token) {
      throw new CustomError("APIFY_API_KEY is missing", HttpStatusCode.InternalServerError)
    }
    this.client = new ApifyClient({ token: this.token })
  }

  async runInstagramHashtagActor(params: { hashtags: string[]; resultsType?: "posts" | "reels"; resultsLimit?: number; actorId?: string; tokenOverride?: string }): Promise<{ items: any[]; run: any }> {
    const actorId = params.actorId || process.env.APIFY_INSTAGRAM_ACTOR_ID || "reGe1ST3OBgYZSsZJ"
    const resultsType = params.resultsType || "posts"
    const resultsLimit = Math.min(Math.max(Number(params.resultsLimit || 20), 1), 200)
    if (params.tokenOverride) this.token = params.tokenOverride
    await this.ensureClient()
    try {
      const input = { hashtags: params.hashtags, resultsType, resultsLimit }
      const run = await this.client.actor(actorId).call(input)
      const { items } = await this.client.dataset(run.defaultDatasetId).listItems()
      return { items, run }
    } catch (error: any) {
      throw new CustomError(error?.message || "Error scraping Instagram viral posts", error?.response?.status || HttpStatusCode.InternalServerError, error)
    }
  }

  private extractHashtagsFromCaption(caption?: string): string[] {
    if (!caption || typeof caption !== "string") return []
    const tags = Array.from(caption.matchAll(/#([\p{L}\p{N}_]+)/gu)).map(m => m[1])
    return tags
  }

  mapInstagramItemsToSample(items: any[]): Array<{ caption: string; ownerFullName?: string; ownerUsername?: string; url?: string; commentsCount?: number; firstComment?: string; likesCount?: number; timestamp?: string; hashtags: string[] }> {
    return (items || []).map((item: any) => {
      const caption = item?.caption || item?.title || ""
      const hashtags = Array.isArray(item?.hashtags) && item.hashtags.length ? item.hashtags : this.extractHashtagsFromCaption(caption)
      const ts = (() => {
        const t = item?.timestamp || item?.taken_at_timestamp || item?.published_time
        if (!t) return undefined
        if (typeof t === "number") return new Date((t as number) * 1000).toISOString()
        try { return new Date(t).toISOString() } catch { return undefined }
      })()
      const firstComment = item?.firstComment || item?.first_comment || (Array.isArray(item?.top_comments) && item.top_comments.length ? item.top_comments[0] : undefined)
      return {
        caption,
        ownerFullName: item?.ownerFullName || item?.owner_full_name || item?.full_name,
        ownerUsername: item?.ownerUsername || item?.username || item?.owner_username,
        url: item?.permalink || item?.url,
        commentsCount: typeof item?.comments_count === "number" ? item.comments_count : (typeof item?.comments === "number" ? item.comments : undefined),
        firstComment,
        likesCount: typeof item?.like_count === "number" ? item.like_count : (typeof item?.likes === "number" ? item.likes : undefined),
        timestamp: ts,
        hashtags
      }
    })
  }

  async getInstagramViralPostsByHashtags(params: { hashtags: string[]; resultsType?: "posts" | "reels"; resultsLimit?: number; actorId?: string; tokenOverride?: string }): Promise<{ items: Array<{ caption: string; ownerFullName?: string; ownerUsername?: string; url?: string; commentsCount?: number; firstComment?: string; likesCount?: number; timestamp?: string; hashtags: string[] }>; count: number }> {
    const { items } = await this.runInstagramHashtagActor(params)
    const normalized = this.mapInstagramItemsToSample(items)
    return { items: normalized, count: normalized.length }
  }
}

export const scrapperService = new ScrapperService()
export default ScrapperService