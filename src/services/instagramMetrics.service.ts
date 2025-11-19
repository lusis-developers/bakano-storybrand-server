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

  private formatLocalDateTime(d: Date, tz?: string, offsetMinutes?: number): { date: string; time: string } {
    if (tz && tz.trim()) {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz.trim(), hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(d)
      const get = (type: string) => parts.find(p => p.type === type)?.value || ''
      return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` }
    }
    if (Number.isFinite(offsetMinutes)) {
      const adj = new Date(d.getTime() + (offsetMinutes as number) * 60000)
      const iso = adj.toISOString()
      return { date: iso.slice(0, 10), time: iso.slice(11, 16) }
    }
    const iso = d.toISOString()
    return { date: iso.slice(0, 10), time: iso.slice(11, 16) }
  }

  async buildWindows(params: { igUserId: string; accessToken: string; currentFollowers: number; userPlan: 'free' | 'starter' | 'pro' | 'enterprise'; series?: boolean; tz?: string; offsetMinutes?: number; businessId?: string }): Promise<Record<'1m' | '3m' | '6m', any>> {
    const { igUserId, accessToken, currentFollowers, userPlan, series, tz, offsetMinutes, businessId } = params
    const maxDaysByPlan: Record<'free' | 'starter' | 'pro' | 'enterprise', number> = { free: 28, starter: 28, pro: 90, enterprise: 180 }
    const targets: { key: '1m' | '3m' | '6m'; days: number; preset?: 'last_28d' | 'last_90d' }[] = [
      { key: '1m', days: 28, preset: 'last_28d' },
      { key: '3m', days: 90 },
      { key: '6m', days: 180 }
    ]
    const windows: Record<'1m' | '3m' | '6m', any> = {} as any
    for (const t of targets) {
      const allowedDays = maxDaysByPlan[userPlan]
      if (t.days > allowedDays) continue
      let since: string | undefined
      let until: string | undefined
      let date_preset: string | undefined
      if (t.preset) date_preset = t.preset
      if (!date_preset) {
        const yesterday = new Date(Date.now() - 86400000)
        const untilDate = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate(), 23, 59, 59))
        const sinceDate = new Date(untilDate.getTime() - t.days * 86400000)
        since = sinceDate.toISOString()
        until = untilDate.toISOString()
      }
      let netChange = 0
      let seriesData: any[] = []
      if (t.days <= 30) {
        const insight = await instagramService.getUserInsights(igUserId, accessToken, ['follower_count'], {
          period: 'day',
          since,
          until,
          date_preset: date_preset as any,
          metric_type: 'time_series'
        })
        seriesData = Array.isArray((insight as any)?.follower_count?.values) ? (insight as any).follower_count.values : []
        netChange = seriesData.reduce((sum: number, v: any) => sum + (typeof v.value === 'number' ? v.value : 0), 0)
        if (businessId) await this.upsertLast30DaysFollowerDeltas(businessId, igUserId, accessToken)
      } else {
        const agg = await this.getNetChange(igUserId, t.days)
        netChange = agg.netChange
        seriesData = []
      }
      const startEstimate = currentFollowers - netChange
      const formattedSeries = series
        ? seriesData.map((v: any) => {
          const dt = v?.end_time ? new Date(v.end_time) : undefined
          const loc = dt ? this.formatLocalDateTime(dt, tz, offsetMinutes) : { date: '', time: '' }
          return { date: loc.date, time: loc.time, value: typeof v.value === 'number' ? v.value : 0 }
        })
        : undefined
      windows[t.key] = {
        months: t.days === 28 ? 1 : (t.days === 90 ? 3 : 6),
        range: since && until ? { since, until } : undefined,
        preset: date_preset,
        netChange,
        currentFollowers,
        estimatedStartFollowers: startEstimate,
        series: formattedSeries
      }
    }
    return windows
  }

  async buildMonthComparison(igUserId: string, accessToken: string, currentFollowers: number): Promise<any> {
    const yesterday = new Date(Date.now() - 86400000)
    const untilCurDate = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate(), 23, 59, 59))
    const sinceCurDate = new Date(untilCurDate.getTime() - 28 * 86400000)
    const curInsight = await instagramService.getUserInsights(igUserId, accessToken, ['follower_count'], {
      period: 'day',
      since: sinceCurDate.toISOString(),
      until: untilCurDate.toISOString(),
      metric_type: 'time_series'
    })
    const curSeries = Array.isArray((curInsight as any)?.follower_count?.values) ? (curInsight as any).follower_count.values : []
    const curNet = curSeries.reduce((s: number, v: any) => s + (typeof v.value === 'number' ? v.value : 0), 0)
    const prevEndFollowers = currentFollowers - curNet
    const changeAbs = curNet
    const changePct = prevEndFollowers > 0 ? Math.round((changeAbs / prevEndFollowers) * 100) : 0
    return {
      month: {
        current: { endFollowers: currentFollowers, netChange: curNet },
        previous: { endFollowers: prevEndFollowers },
        change: { absolute: changeAbs, percent: changePct },
        ranges: { current: { since: sinceCurDate.toISOString(), until: untilCurDate.toISOString() } }
      }
    }
  }
}

export const instagramMetricsService = new InstagramMetricsService()