import { Schema, model, Document, Types, Model } from 'mongoose';

// --- INTERFACES ---

export interface IIntegration extends Document {
  name: string;
  type: 'facebook' | 'instagram' | 'google' | 'mailchimp' | 'stripe' | 'zapier' | 'hubspot' | 'salesforce' | 'other';
  description?: string;
  business: Types.ObjectId;
  config: {
    apiKey?: string;
    accessToken?: string;
    refreshToken?: string;
    tokenExpiresAt?: Date;
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
  // Virtuals
  connectionStatus?: 'inactive' | 'disconnected' | 'error' | 'connected';
}

// Interface for static methods, updated for the two-step flow
export interface IIntegrationModel extends Model<IIntegration> {
  upsertUserToken(
    businessId: string | Types.ObjectId,
    userAccessToken: string,
    expiresIn: number,
    type: 'instagram' | 'facebook'
  ): Promise<IIntegration>;
  finalizeWithPageToken(
    businessId: string | Types.ObjectId,
    pageId: string,
    pageName: string,
    pageAccessToken: string,
    type: 'instagram' | 'facebook'
  ): Promise<IIntegration | null>;
  disconnectIntegration(businessId: string | Types.ObjectId, type: 'instagram' | 'facebook'): Promise<IIntegration | null>;
  saveAdAccountId(businessId: string | Types.ObjectId, adAccountId: string): Promise<IIntegration | null>;
  saveUserAccessToken(businessId: string | Types.ObjectId, userAccessToken: string, expiresIn?: number): Promise<IIntegration | null>;
}

// --- SCHEMA DEFINITION ---

const integrationSchema = new Schema<IIntegration>({
  name: {
    type: String,
    required: [true, 'Integration name is required'],
    trim: true,
    maxlength: [100, 'Integration name cannot exceed 100 characters']
  },
  type: {
    type: String,
    enum: ['facebook', 'instagram', 'google', 'mailchimp', 'stripe', 'zapier', 'hubspot', 'salesforce', 'other'],
    required: [true, 'Integration type is required']
  },
  business: {
    type: Schema.Types.ObjectId,
    ref: 'Business',
    required: [true, 'Business reference is required']
  },
  config: {
    accessToken: {
      type: String,
      select: false 
    },
    tokenExpiresAt: {
      type: Date
    },
    // Manteniendo otros campos por si los necesitas para otras integraciones
    apiKey: { type: String, select: false },
    refreshToken: { type: String, select: false },
    clientId: { type: String, trim: true },
    clientSecret: { type: String, select: false },
    webhookUrl: { type: String, trim: true },
    customFields: { type: Schema.Types.Mixed, default: {} }
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
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  }
  // Se omiten otros campos para brevedad, puedes mantenerlos si los usas
}, {
  timestamps: true,
  versionKey: false,
});

// --- INDEXES ---

// One integration per business per type (facebook, instagram, etc.)
integrationSchema.index({ business: 1, type: 1 }, { unique: true });
integrationSchema.index({ business: 1 });
integrationSchema.index({ type: 1 });


// --- VIRTUALS ---

integrationSchema.virtual('connectionStatus').get(function() {
  if (!this.isActive) return 'inactive';
  if (this.metadata?.status === 'pending_page_selection') return 'pending';
  if (!this.isConnected) return 'disconnected';
  if (this.errorLog && this.errorLog.some(error => !error.resolved)) return 'error';
  return 'connected';
});


// --- STATIC METHODS (LOGIC FOR FACEBOOK/INSTAGRAM INTEGRATION) ---

/**
 * STEP 1: Saves the long-lived USER access token and puts the integration in a "pending" state.
 */
integrationSchema.statics.upsertUserToken = async function(
  businessId: string | Types.ObjectId,
  userAccessToken: string,
  expiresIn: number,
  type: 'instagram' | 'facebook'
): Promise<IIntegration> {
  const tokenExpiresAt = new Date();
  tokenExpiresAt.setSeconds(tokenExpiresAt.getSeconds() + expiresIn);
  
  const integration = await this.findOneAndUpdate(
    { 
      business: businessId,
      type
    },
    {
      $set: {
        name: type === 'instagram' ? 'Instagram (Pending Page Selection)' : 'Facebook (Pending Page Selection)',
        type,
        business: businessId,
        'config.accessToken': userAccessToken,
        'config.tokenExpiresAt': tokenExpiresAt,
        isActive: true,
        isConnected: false, // Not fully connected yet
        'metadata.status': 'pending_page_selection',
        'metadata.userAccessToken': userAccessToken,
        'metadata.userTokenExpiresAt': tokenExpiresAt
      }
    },
    { new: true, upsert: true }
  );
  
  return integration;
};

/**
 * STEP 2: Replaces the user token with the PAGE token and finalizes the connection.
 */
integrationSchema.statics.finalizeWithPageToken = async function(
  businessId: string | Types.ObjectId,
  pageId: string,
  pageName: string,
  pageAccessToken: string,
  type: 'instagram' | 'facebook'
): Promise<IIntegration | null> {
  const current = await this.findOne({ business: businessId, type });

  const prevUserToken = current?.config?.accessToken || null;

  const integration = await this.findOneAndUpdate(
    { 
      business: businessId,
      type
    },
    {
      $set: {
        name: type === 'instagram' ? `Instagram: ${pageName}` : `Facebook Page: ${pageName}`,
        description: type === 'instagram' ? 'Instagram Business' : 'Facebook Page',
        'config.accessToken': pageAccessToken, // The final PAGE token
        'config.tokenExpiresAt': null, // Page tokens generally don't expire
        isConnected: true, // Connection is now complete and active
        'metadata.pageId': pageId,
        'metadata.pageName': pageName,
        'metadata.status': 'connected',
        ...(prevUserToken ? { 'metadata.userAccessToken': prevUserToken } : {}),
        lastSyncAt: new Date()
      }
    },
    { new: true }
  );
  
  return integration;
};

/**
 * Disconnects the Meta integration by clearing sensitive data and updating status.
 */
integrationSchema.statics.disconnectIntegration = async function(
  businessId: string | Types.ObjectId,
  type: 'instagram' | 'facebook'
): Promise<IIntegration | null> {
  const integration = await this.findOneAndUpdate(
    { business: businessId, type },
    {
      $set: {
        isConnected: false,
        'config.accessToken': null,
        'config.refreshToken': null,
        'config.tokenExpiresAt': null,
        'metadata.status': 'disconnected'
      }
    },
    { new: true }
  );
  return integration;
};

integrationSchema.statics.saveAdAccountId = async function(
  businessId: string | Types.ObjectId,
  adAccountId: string
): Promise<IIntegration | null> {
  const integration = await this.findOneAndUpdate(
    { business: businessId, type: 'facebook' },
    {
      $set: {
        'metadata.adAccountId': adAccountId,
        'metadata.status': 'pending_ad_account'
      },
      $setOnInsert: {
        name: 'Facebook',
        type: 'facebook',
        business: businessId,
        isActive: true,
        isConnected: false
      }
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return integration;
};

integrationSchema.statics.saveUserAccessToken = async function(
  businessId: string | Types.ObjectId,
  userAccessToken: string,
  expiresIn?: number
): Promise<IIntegration | null> {
  const update: any = {
    $set: {
      'metadata.userAccessToken': userAccessToken,
    }
  };
  if (expiresIn && Number.isFinite(expiresIn)) {
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setSeconds(tokenExpiresAt.getSeconds() + expiresIn);
    update.$set['metadata.userTokenExpiresAt'] = tokenExpiresAt;
  }
  const integration = await this.findOneAndUpdate(
    { business: businessId, type: 'facebook' },
    update,
    { new: true }
  );
  return integration;
};


// --- FINAL SETUP ---

integrationSchema.set('toJSON', { virtuals: true });
integrationSchema.set('toObject', { virtuals: true });

export const Integration = model<IIntegration, IIntegrationModel>('Integration', integrationSchema);
export default Integration;
