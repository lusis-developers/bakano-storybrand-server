import { Schema, model, Document } from 'mongoose'

export interface IJobLock extends Document {
  key: string
  lockedAt?: Date
  expiresAt?: Date
  createdAt: Date
  updatedAt: Date
}

const jobLockSchema = new Schema<IJobLock>({
  key: { type: String, required: true, unique: true },
  lockedAt: { type: Date },
  expiresAt: { type: Date }
}, {
  timestamps: true,
  versionKey: false
})

jobLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const JobLock = model<IJobLock>('JobLock', jobLockSchema)

export default JobLock