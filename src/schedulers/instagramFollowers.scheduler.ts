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
  const lock = await (models.jobLock as any).findOneAndUpdate(
    { key: 'instagram_followers_daily', $or: [{ expiresAt: { $lte: now } }, { lockedAt: { $exists: false } }] },
    { $set: { lockedAt: now, expiresAt: new Date(now.getTime() + 30 * 60 * 1000) } },
    { new: true, upsert: true }
  )
  if (!lock || (lock.expiresAt && lock.expiresAt.getTime() > now.getTime() && lock.lockedAt && lock.lockedAt.getTime() < now.getTime())) {
    return
  }
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
    await (models.jobLock as any).updateOne({ key: 'instagram_followers_daily' }, { $set: { expiresAt: new Date() } })
  }
}

export function scheduleInstagramFollowersDaily(): void {
  const execute = async () => {
    await runJob()
    setTimeout(execute, nextRunDelay())
  }
  execute()
}