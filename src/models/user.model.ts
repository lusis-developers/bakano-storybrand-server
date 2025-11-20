import { Schema, model, Document, Types } from 'mongoose';



export interface ISubscription {
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  status: 'free' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused' | 'incomplete';
  provider?: 'stripe' | 'manual' | 'payphone';
  customerId?: string; // ID del cliente en el proveedor (p.ej., Stripe)
  subscriptionId?: string; // ID de la suscripción en el proveedor
  billingInterval?: 'monthly' | 'yearly';
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  trialStart?: Date;
  trialEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: Date;
  nextBillingDate?: Date;
  paymentMethodId?: string; // Referencia al método de pago (token/ID)
  providerMetadata?: Record<string, any>; // Datos específicos del proveedor (flexible para cambios futuros)
}

export interface IUser extends Document {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  birthDate?: Date;
  nationalId?: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  businesses: Types.ObjectId[];
  role: 'admin' | 'client';
  isVerified: boolean;
  verificationToken?: string;
  verificationTokenExpires?: Date;
  onboarding?: Types.ObjectId;
  subscription?: ISubscription;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  nationalId: {
    type: String,
    trim: true,
    maxlength: [32, 'National ID cannot exceed 32 characters']
  },
  phone: {
    type: String,
    trim: true,
    match: [/^[\+]?[1-9][\d]{0,15}$/, 'Please enter a valid phone number']
  },
  address: {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    zipCode: { type: String, trim: true },
    country: { type: String, trim: true }
  },
  birthDate: {
    type: Date,
    validate: {
      validator: function(date: Date | undefined) {
        return !date || date < new Date();
      },
      message: 'Birth date must be before current date'
    }
  },
  businesses: [{
    type: Schema.Types.ObjectId,
    ref: 'Business'
  }],
  role: {
    type: String,
    enum: ['admin', 'client'],
    default: 'client'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationToken: {
    type: String,
    select: false
  },
  verificationTokenExpires: {
    type: Date,
    select: false
  },
  onboarding: {
    type: Schema.Types.ObjectId,
    ref: 'Onboarding'
  },
  // Información de suscripción y trial de 7 días
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'starter', 'pro', 'enterprise'],
      default: 'free'
    },
    status: {
      type: String,
      enum: ['free', 'trialing', 'active', 'past_due', 'canceled', 'paused', 'incomplete'],
      default: 'free'
    },
    provider: {
      type: String,
      enum: ['stripe', 'manual', 'payphone']
    },
    customerId: {
      type: String,
      select: false
    },
    subscriptionId: {
      type: String,
      select: false
    },
    billingInterval: {
      type: String,
      enum: ['monthly', 'yearly']
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
  }
}, {
  timestamps: true,
  versionKey: false,
});

userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.virtual('age').get(function() {
  if (!this.birthDate) {
    return null;
  }
  
  const today = new Date();
  const birth = new Date(this.birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const month = today.getMonth() - birth.getMonth();
  
  if (month < 0 || (month === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
});



userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

// Índices útiles para gestionar estados y renovaciones/trials
userSchema.index({ 'subscription.status': 1 });
userSchema.index({ 'subscription.trialEnd': 1 });
userSchema.index({ 'subscription.currentPeriodEnd': 1 });

export const User = model<IUser>('User', userSchema);

export default User;