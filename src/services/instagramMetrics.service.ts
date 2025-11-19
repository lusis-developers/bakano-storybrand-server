import models from '../models'
import { instagramService } from './instagram.service'
import { Types } from 'mongoose'

export class InstagramMetricsService {
  async upsertLast30DaysFollowerDeltas(businessId: string | Types.ObjectId, igUserId: string, accessToken: string): Promise<number> {
    const yesterday = new Date(Date.now() - 86400000)
    const untilDate = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate(), 23, 59, 59))
    const sinceDate = new Date(untilDate.getTime() - 28 * 86400000)
    const insight = await instagramService.getUserInsights(igUserId, accessToken, ['follower_count'], {
      period: 'day',
      since: sinceDate.toISOString(),
      until: untilDate.toISOString(),
      metric_type: 'time_series'
    })
    const series = Array.isArray((insight as any)?.follower_count?.values) ? (insight as any).follower_count.values : []
    let upserts = 0
    for (const v of series) {
      const d = v?.end_time ? new Date(v.end_time) : undefined
      if (!d) continue
      const date = d.toISOString().slice(0, 10)
      const followerDelta = typeof v.value === 'number' ? v.value : 0
      const existing = await (models.instagramMetrics as any).findOne({ igUserId, date })
      if (existing) {
        if (existing.followerDelta !== followerDelta) {
          await (models.instagramMetrics as any).updateOne({ _id: existing._id }, { $set: { followerDelta } })
        }
        continue
      }
      await (models.instagramMetrics as any).create({ business: businessId, igUserId, date, followerDelta })
      upserts++
    }
    return upserts
  }

  async getNetChange(igUserId: string, days: number): Promise<{ netChange: number; coverageDays: number }> {
    const yesterday = new Date(Date.now() - 86400000)
    const untilDate = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate(), 23, 59, 59))
    const sinceDate = new Date(untilDate.getTime() - days * 86400000)
    const sinceStr = sinceDate.toISOString().slice(0, 10)
    const untilStr = untilDate.toISOString().slice(0, 10)
    const docs = await (models.instagramMetrics as any).find({ igUserId, date: { $gte: sinceStr, $lte: untilStr } })
    const netChange = docs.reduce((sum: number, doc: any) => sum + (typeof doc.followerDelta === 'number' ? doc.followerDelta : 0), 0)
    return { netChange, coverageDays: docs.length }
  }
}

export const instagramMetricsService = new InstagramMetricsService()