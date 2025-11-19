import models from '../models'
import { instagramMetricsService } from '../services/instagramMetrics.service'

function nextRunDelay(): number {
  const now = new Date()
  const next = new Date(now.getTime())
  next.setUTCDate(now.getUTCDate() + 1)
  next.setUTCHours(1, 0, 0, 0)
  return next.getTime() - now.getTime()
}

async function runJob(): Promise<void> {
  const now = new Date()
  const ttlMs = 30 * 60 * 1000
  const key = 'instagram_followers_daily'
  const expireAt = new Date(now.getTime() + ttlMs)
  let acquired = false
  try {
    const updated = await (models.jobLock as any).findOneAndUpdate(
      { key, $or: [{ expiresAt: { $lte: now } }, { expiresAt: { $exists: false } }] },
      { $set: { lockedAt: now, expiresAt: expireAt } },
      { new: true }
    )
    if (updated) {
      acquired = true
    } else {
      try {
        await (models.jobLock as any).create({ key, lockedAt: now, expiresAt: expireAt })
        acquired = true
      } catch (e: any) {
        if (e && (e.code === 11000 || String(e.message || '').includes('E11000'))) {
          acquired = false
        } else {
          throw e
        }
      }
    }
  } catch (e: any) {
    if (e && (e.code === 11000 || String(e.message || '').includes('E11000'))) {
      return
    }
    throw e
  }
  if (!acquired) return
  try {
    const integrations = await (models.integration as any).find({ type: 'instagram', isConnected: true }).select('+config.accessToken metadata.instagramAccountId business')
    for (const integ of integrations) {
      const igUserId: string | undefined = integ?.metadata?.instagramAccountId
      const accessToken: string | undefined = integ?.config?.accessToken
      if (!igUserId || !accessToken) continue
      try {
        await instagramMetricsService.upsertLast30DaysFollowerDeltas(integ.business, igUserId, accessToken)
      } catch {}
    }
  } finally {
    await (models.jobLock as any).updateOne({ key }, { $set: { expiresAt: new Date() } })
  }
}

export function scheduleInstagramFollowersDaily(): void {
  const execute = async () => {
    await runJob()
    setTimeout(execute, nextRunDelay())
  }
  execute()
}