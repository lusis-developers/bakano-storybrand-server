import { Schema, model, Document, Types } from 'mongoose';

export interface IIntegration extends Document {
  name: string;
  type: 'meta' | 'google' | 'mailchimp' | 'stripe' | 'zapier' | 'hubspot' | 'salesforce' | 'other';
  description?: string;
  business: Types.ObjectId;
  config: {
    apiKey?: string;
    accessToken?: string;
    refreshToken?: string;
    clientId?: string;
    clientSecret?: string;
    webhookUrl?: string;
    customFields?: Record<string, any>;
  };
  isActive: boolean;
  isConnected: boolean;
  lastSyncAt?: Date;
  syncFrequency?: 'realtime' | 'hourly' | 'daily' | 'weekly' | 'manual';
  errorLog?: {
    message: string;
    timestamp: Date;
    resolved: boolean;
  }[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const integrationSchema = new Schema<IIntegration>({
  name: {
    type: String,
    required: [true, 'Integration name is required'],
    trim: true,
    maxlength: [100, 'Integration name cannot exceed 100 characters']
  },
  type: {
    type: String,
    enum: ['meta', 'google', 'mailchimp', 'stripe', 'zapier', 'hubspot', 'salesforce', 'other'],
    required: [true, 'Integration type is required']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  business: {
    type: Schema.Types.ObjectId,
    ref: 'Business',
    required: [true, 'Business reference is required']
  },
  config: {
    apiKey: {
      type: String,
      select: false // Sensitive data, don't include by default
    },
    accessToken: {
      type: String,
      select: false // Sensitive data, don't include by default
    },
    refreshToken: {
      type: String,
      select: false // Sensitive data, don't include by default
    },
    clientId: {
      type: String,
      trim: true
    },
    clientSecret: {
      type: String,
      select: false // Sensitive data, don't include by default
    },
    webhookUrl: {
      type: String,
      trim: true,
      match: [/^https?:\/\/.+/, 'Please enter a valid webhook URL']
    },
    customFields: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isConnected: {
    type: Boolean,
    default: false
  },
  lastSyncAt: {
    type: Date
  },
  syncFrequency: {
    type: String,
    enum: ['realtime', 'hourly', 'daily', 'weekly', 'manual'],
    default: 'manual'
  },
  errorLog: [{
    message: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    resolved: {
      type: Boolean,
      default: false
    }
  }],
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  versionKey: false,
});

// Índices para mejorar el rendimiento
integrationSchema.index({ business: 1 });
integrationSchema.index({ type: 1 });
integrationSchema.index({ isActive: 1, isConnected: 1 });
integrationSchema.index({ business: 1, type: 1 }, { unique: true });

// Virtual para obtener el estado de la conexión
integrationSchema.virtual('connectionStatus').get(function() {
  if (!this.isActive) return 'inactive';
  if (!this.isConnected) return 'disconnected';
  if (this.errorLog && this.errorLog.some(error => !error.resolved)) return 'error';
  return 'connected';
});

// Virtual para obtener errores no resueltos
integrationSchema.virtual('unresolvedErrors').get(function() {
  return this.errorLog ? this.errorLog.filter(error => !error.resolved) : [];
});

// Método para agregar un error al log
integrationSchema.methods.addError = function(message: string) {
  if (!this.errorLog) this.errorLog = [];
  this.errorLog.push({
    message,
    timestamp: new Date(),
    resolved: false
  });
  return this.save();
};

// Método para marcar errores como resueltos
integrationSchema.methods.resolveErrors = function() {
  if (this.errorLog) {
    this.errorLog.forEach((error: { resolved: boolean }) => {
      error.resolved = true;
    });
  }
  return this.save();
};

// Método para actualizar el último sync
integrationSchema.methods.updateLastSync = function() {
  this.lastSyncAt = new Date();
  return this.save();
};

integrationSchema.set('toJSON', { virtuals: true });
integrationSchema.set('toObject', { virtuals: true });

export const Integration = model<IIntegration>('Integration', integrationSchema);

export default Integration;