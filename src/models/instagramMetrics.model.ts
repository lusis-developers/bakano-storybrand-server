import { Schema, model, Document, Types } from 'mongoose'

export interface IInstagramMetric extends Document {
  business: Types.ObjectId
  igUserId: string
  date: string
  followerDelta: number
  createdAt: Date
  updatedAt: Date
}

const instagramMetricSchema = new Schema<IInstagramMetric>({
  business: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
  igUserId: { type: String, required: true, index: true },
  date: { type: String, required: true },
  followerDelta: { type: Number, required: true }
}, {
  timestamps: true,
  versionKey: false
})

instagramMetricSchema.index({ igUserId: 1, date: 1 }, { unique: true })
instagramMetricSchema.index({ business: 1, date: 1 })

export const InstagramMetric = model<IInstagramMetric>('InstagramMetric', instagramMetricSchema)

export default InstagramMetric