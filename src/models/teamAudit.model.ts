import { Schema, model, Document, Types } from 'mongoose';

export interface ITeamAudit extends Document {
  business: Types.ObjectId;
  actor: Types.ObjectId;
  targetUser?: Types.ObjectId;
  action: 'invited' | 'accepted' | 'role_updated' | 'revoked';
  role?: 'owner' | 'admin' | 'collaborator' | 'viewer';
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const teamAuditSchema = new Schema<ITeamAudit>({
  business: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
  actor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  targetUser: { type: Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, enum: ['invited', 'accepted', 'role_updated', 'revoked'], required: true },
  role: { type: String, enum: ['owner', 'admin', 'collaborator', 'viewer'] },
  metadata: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true,
  versionKey: false,
});

teamAuditSchema.index({ business: 1, createdAt: -1 });

teamAuditSchema.set('toJSON', { virtuals: true });
teamAuditSchema.set('toObject', { virtuals: true });

export const TeamAudit = model<ITeamAudit>('TeamAudit', teamAuditSchema);

export default TeamAudit;