import { Schema, model, Document, Types } from 'mongoose';

export interface IBusiness extends Document {
  name: string;
  description?: string;
  industry?: string;
  website?: string;
  phone?: string;
  email?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  owner: Types.ObjectId;
  employees?: Types.ObjectId[];
  integrations?: Types.ObjectId[];
  teamMembers?: Array<{
    user: Types.ObjectId;
    role: 'owner' | 'admin' | 'collaborator' | 'viewer';
    status: 'invited' | 'active' | 'removed';
    invitedBy?: Types.ObjectId;
    invitedAt?: Date;
    joinedAt?: Date;
  }>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const businessSchema = new Schema<IBusiness>({
  name: {
    type: String,
    required: [true, 'Business name is required'],
    trim: true,
    maxlength: [100, 'Business name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  industry: {
    type: String,
    trim: true,
    maxlength: [50, 'Industry cannot exceed 50 characters']
  },
  website: {
    type: String,
    trim: true,
    match: [/^https?:\/\/.+/, 'Please enter a valid website URL']
  },
  phone: {
    type: String,
    trim: true,
    match: [/^[\+]?[1-9][\d]{0,15}$/, 'Please enter a valid phone number']
  },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    match: [/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/, 'Please enter a valid email']
  },
  address: {
    street: {
      type: String,
      trim: true,
      maxlength: [100, 'Street cannot exceed 100 characters']
    },
    city: {
      type: String,
      trim: true,
      maxlength: [50, 'City cannot exceed 50 characters']
    },
    state: {
      type: String,
      trim: true,
      maxlength: [50, 'State cannot exceed 50 characters']
    },
    zipCode: {
      type: String,
      trim: true,
      maxlength: [20, 'Zip code cannot exceed 20 characters']
    },
    country: {
      type: String,
      trim: true,
      maxlength: [50, 'Country cannot exceed 50 characters']
    }
  },
  owner: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Business owner is required']
  },
  employees: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  teamMembers: [{
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['owner', 'admin', 'collaborator', 'viewer'], default: 'collaborator' },
    status: { type: String, enum: ['invited', 'active', 'removed'], default: 'invited' },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    invitedAt: { type: Date, default: Date.now },
    joinedAt: { type: Date }
  }],
  integrations: [{
    type: Schema.Types.ObjectId,
    ref: 'Integration'
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  versionKey: false,
});

// Índices para mejorar el rendimiento
businessSchema.index({ owner: 1 });
businessSchema.index({ name: 1 });
businessSchema.index({ isActive: 1 });
businessSchema.index({ 'teamMembers.user': 1 });

// Virtual para obtener el número de empleados
businessSchema.virtual('employeeCount').get(function(this: any) {
  return this.employees ? this.employees.length : 0;
});

// Virtual para obtener el número de integraciones
businessSchema.virtual('integrationCount').get(function(this: any) {
  return this.integrations ? this.integrations.length : 0;
});

businessSchema.virtual('teamCount').get(function(this: any) {
  return this.teamMembers ? this.teamMembers.length : 0;
});

businessSchema.set('toJSON', { virtuals: true });
businessSchema.set('toObject', { virtuals: true });

export const Business = model<IBusiness>('Business', businessSchema);

export default Business;