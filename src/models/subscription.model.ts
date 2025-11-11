import { Schema, model, Document, Types } from 'mongoose';

export interface ISubscriptionModel extends Document {
  user: Types.ObjectId;
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  status: 'free' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused' | 'incomplete';
  provider?: 'stripe' | 'manual' | 'payphone';
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  billingInterval?: 'monthly' | 'yearly';
  priceId?: string; // Identificador del precio/plan en el proveedor
  amount?: number; // Monto a cobrar (en la menor unidad del currency si aplica)
  currency?: string; // p.ej. 'USD'
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  trialStart?: Date;
  trialEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: Date;
  nextBillingDate?: Date;
  paymentMethodId?: string;
  providerMetadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema<ISubscriptionModel>({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  plan: {
    type: String,
    enum: ['free', 'starter', 'pro', 'enterprise'],
    required: true
  },
  status: {
    type: String,
    enum: ['free', 'trialing', 'active', 'past_due', 'canceled', 'paused', 'incomplete'],
    required: true
  },
  provider: {
    type: String,
    enum: ['stripe', 'manual', 'payphone']
  },
  providerCustomerId: {
    type: String,
    select: false
  },
  providerSubscriptionId: {
    type: String,
    select: false
  },
  billingInterval: {
    type: String,
    enum: ['monthly', 'yearly']
  },
  priceId: {
    type: String
  },
  amount: {
    type: Number
  },
  currency: {
    type: String,
    default: 'USD'
  },
  currentPeriodStart: {
    type: Date
  },
  currentPeriodEnd: {
    type: Date
  },
  trialStart: {
    type: Date
  },
  trialEnd: {
    type: Date
  },
  cancelAtPeriodEnd: {
    type: Boolean,
    default: false
  },
  canceledAt: {
    type: Date
  },
  nextBillingDate: {
    type: Date
  },
  paymentMethodId: {
    type: String,
    select: false
  },
  providerMetadata: {
    type: Schema.Types.Mixed,
    select: false
  }
}, {
  timestamps: true,
  versionKey: false,
});

// Índices para consultas eficientes
subscriptionSchema.index({ user: 1, status: 1 });
subscriptionSchema.index({ provider: 1, providerSubscriptionId: 1 }, { unique: true, sparse: true });
subscriptionSchema.index({ nextBillingDate: 1 });
subscriptionSchema.index({ currentPeriodEnd: 1 });

export const Subscription = model<ISubscriptionModel>('Subscription', subscriptionSchema);
export default Subscription;