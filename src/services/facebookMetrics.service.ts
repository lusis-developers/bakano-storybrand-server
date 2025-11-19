import { Types } from 'mongoose'
import models from '../models'
import { facebookService } from './facebook.service'

export interface MetricsQuery {
  period?: string
  since?: string
  until?: string
  date_preset?: string
  view?: string
  months?: string
  tz?: string
  offsetMinutes?: string
}

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0))
}

function endOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59))
}

function monthsAgo(d: Date, m: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - m, 1, 0, 0, 0))
}

function diffDays(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / 86400000)
}

function formatLocalDateTime(d: Date, tz?: string, offsetMinutes?: number): { date: string; time: string } {
  if (tz && tz.trim()) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).formatToParts(d)
    const get = (type: string) => parts.find(p => p.type === type)?.value || ''
    const year = get('year')
    const month = get('month')
    const day = get('day')
    const hour = get('hour')
    const minute = get('minute')
    return { date: `${year}-${month}-${day}`, time: `${hour}:${minute}` }
  }
  if (Number.isFinite(offsetMinutes)) {
    const adj = new Date(d.getTime() + (offsetMinutes as number) * 60000)
    const iso = adj.toISOString()
    return { date: iso.slice(0, 10), time: iso.slice(11, 16) }
  }
  const iso = d.toISOString()
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) }
}

export class FacebookMetricsService {
  async getBusinessPageMetrics(businessId: string, query: MetricsQuery): Promise<{ data: any; filters: any }> {
    if (!businessId || !Types.ObjectId.isValid(businessId)) {
      throw new Error('Invalid or missing businessId parameter')
    }

    const integration = await models.integration.findOne({
      business: businessId,
      type: 'facebook',
      isConnected: true
    }).select('+config.accessToken')

    if (!integration || !integration.config.accessToken || !integration.metadata?.pageId) {
      throw new Error('Active Facebook integration not found or is incomplete for this business')
    }

    const pageAccessToken = integration.config.accessToken as string
    const pageId = integration.metadata.pageId as string

    const biz = await models.business.findById(businessId).select('owner')
    const ownerUser = biz ? await models.user.findById(biz.owner).select('subscription.plan') : null
    const userPlan = (ownerUser?.subscription?.plan as 'free' | 'starter' | 'pro' | 'enterprise') || 'free'
    const maxMonthsByPlan: Record<'free' | 'starter' | 'pro' | 'enterprise', number> = {
      free: 1,
      starter: 1,
      pro: 3,
      enterprise: 6
    }
    const maxDaysByPlan: Record<'free' | 'starter' | 'pro' | 'enterprise', number> = {
      free: 28,
      starter: 28,
      pro: 90,
      enterprise: 180
    }
    const requestedMonths = Math.max(1, Math.min(Number(query.months || 1), maxMonthsByPlan[userPlan]))
    const now = new Date()

    let effectivePeriod: any = (query.period as any) || undefined
    let effectiveSince: string | undefined = query.since
    let effectiveUntil: string | undefined = query.until
    let effectivePreset: any = query.date_preset || undefined
    let adjusted = false
    let appliedView = (query.view || '').toLowerCase()
    if (!appliedView) appliedView = 'month'
    if (appliedView === 'week') {
      effectivePeriod = 'day'
      effectivePreset = 'last_7d'
      effectiveSince = undefined
      effectiveUntil = undefined
    } else if (appliedView === 'month') {
      const end = endOfMonth(now)
      const start = monthsAgo(now, requestedMonths - 1)
      const sinceDate = startOfMonth(start)
      const untilDate = end
      const days = diffDays(sinceDate, untilDate)
      const allowedDays = Math.min(maxDaysByPlan[userPlan], 90)
      if (days > allowedDays) {
        effectivePeriod = 'day'
        effectiveSince = undefined
        effectiveUntil = undefined
        adjusted = true
        if (userPlan === 'free' || userPlan === 'starter') {
          effectivePreset = 'last_28d'
        } else {
          effectivePreset = 'last_90d'
        }
      } else {
        effectivePeriod = 'day'
        effectivePreset = undefined
        effectiveSince = sinceDate.toISOString()
        effectiveUntil = untilDate.toISOString()
      }
    } else if (appliedView === 'custom') {
      if (effectiveSince && effectiveUntil) {
        const s = new Date(effectiveSince)
        const u = new Date(effectiveUntil)
        const days = diffDays(s, u)
        const allowedDays = Math.min(maxDaysByPlan[userPlan], 90)
        if (days > allowedDays) {
          effectivePeriod = 'day'
          effectiveSince = undefined
          effectiveUntil = undefined
          adjusted = true
          if (userPlan === 'free' || userPlan === 'starter') {
            effectivePreset = 'last_28d'
          } else {
            effectivePreset = 'last_90d'
          }
        } else {
          effectivePeriod = 'day'
          effectivePreset = undefined
          adjusted = false
        }
      } else {
        effectivePeriod = 'day'
        effectivePreset = 'last_28d'
        adjusted = true
      }
    } else {
      effectivePeriod = 'day'
      effectivePreset = 'this_month'
      effectiveSince = undefined
      effectiveUntil = undefined
    }

    const metrics = [
      'page_impressions',
      'page_impressions_unique',
      'page_impressions_paid',
      'page_post_engagements',
      'page_total_actions'
    ]

    const [followers, insights] = await Promise.all([
      facebookService.getPageFollowerStats(pageAccessToken, pageId),
      facebookService.getPageInsights(pageAccessToken, pageId, metrics, {
        period: effectivePeriod || 'day',
        since: effectiveSince,
        until: effectiveUntil,
        date_preset: effectivePreset || undefined
      })
    ])

    const tz = query.tz && query.tz.trim() ? query.tz.trim() : undefined
    const offsetMinutes = query.offsetMinutes !== undefined ? Number(query.offsetMinutes) : undefined

    const formattedMetrics: Record<string, { total: number; averagePerDay: number; series: Array<{ date: string; time: string; value: number }> }> = {}
    Object.keys(insights || {}).forEach((key) => {
      const metric = (insights as any)[key] || {}
      const values = Array.isArray(metric.values) ? metric.values : []
      const series = values.map((v: any) => {
        const dt = v?.end_time ? new Date(v.end_time) : undefined
        const loc = dt ? formatLocalDateTime(dt, tz, offsetMinutes) : { date: '', time: '' }
        const value = typeof v?.value === 'number' ? v.value : 0
        return { date: loc.date, time: loc.time, value }
      })
      const total = typeof metric.total === 'number' ? metric.total : 0
      const averagePerDay = series.length > 0 ? Math.round(total / series.length) : 0
      formattedMetrics[key] = { total, averagePerDay, series }
    })

    const data = {
      page: { id: pageId, name: integration.metadata?.pageName },
      followers,
      insights: {
        period: effectivePeriod || 'day',
        date_preset: effectivePreset || undefined,
        range: effectiveSince || effectiveUntil ? { since: effectiveSince, until: effectiveUntil } : undefined,
        timezone: tz || (Number.isFinite(offsetMinutes) ? `UTC${(offsetMinutes as number) >= 0 ? '+' : ''}${offsetMinutes}` : 'UTC'),
        metrics: formattedMetrics
      }
    }

    const filters = {
      plan: userPlan,
      maxMonthsByPlan: maxMonthsByPlan[userPlan],
      maxDaysByPlan: maxDaysByPlan[userPlan],
      view: appliedView,
      monthsApplied: appliedView === 'month' ? requestedMonths : undefined,
      adjusted
    }

    return { data, filters }
  }
}

export const facebookMetricsService = new FacebookMetricsService()