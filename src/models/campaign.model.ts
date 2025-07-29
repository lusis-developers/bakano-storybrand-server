import { Schema, model, Document, Types } from 'mongoose';

// Interface para un asset individual de la campaña
export interface ICampaignAsset {
  type: string;
  title: string;
  content?: string;
  status: 'pending' | 'generating' | 'completed' | 'error';
  generatedAt?: Date;
  errorMessage?: string;
  metadata?: {
    wordCount?: number;
    characterCount?: number;
    estimatedReadTime?: number;
  };
}

// Interface principal para Campaign
export interface ICampaign extends Document {
  business: Types.ObjectId;
  brandScript: Types.ObjectId;
  title: string;
  description?: string;
  campaignType: 'general' | 'product_specific' | 'event_specific';
  targetAudience?: string;
  selectedAssets: string[];
  generatedAssets: ICampaignAsset[];
  tone: 'professional' | 'casual' | 'friendly' | 'authoritative' | 'conversational';
  aiProvider: 'openai' | 'gemini';
  status: 'draft' | 'in_progress' | 'completed' | 'archived';
  progress: {
    totalAssets: number;
    completedAssets: number;
    percentage: number;
  };
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  
  // Methods
  updateAssetStatus(assetType: string, status: string, content?: string, errorMessage?: string): boolean;
  isComplete(): boolean;
  getNextPendingAsset(): string | null;
}

// Schema para assets individuales
const campaignAssetSchema = new Schema({
  type: {
    type: String,
    required: true,
    trim: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'generating', 'completed', 'error'],
    default: 'pending'
  },
  generatedAt: {
    type: Date
  },
  errorMessage: {
    type: String,
    trim: true
  },
  metadata: {
    wordCount: {
      type: Number,
      min: 0
    },
    characterCount: {
      type: Number,
      min: 0
    },
    estimatedReadTime: {
      type: Number,
      min: 0
    }
  }
}, { _id: false });

// Schema principal de Campaign
const campaignSchema = new Schema<ICampaign>({
  business: {
    type: Schema.Types.ObjectId,
    ref: 'Business',
    required: true,
    index: true
  },
  brandScript: {
    type: Schema.Types.ObjectId,
    ref: 'BrandScript',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  campaignType: {
    type: String,
    enum: ['general', 'product_specific', 'event_specific'],
    default: 'general'
  },
  targetAudience: {
    type: String,
    trim: true,
    maxlength: [300, 'Target audience cannot exceed 300 characters']
  },
  selectedAssets: [{
    type: String,
    trim: true
  }],
  generatedAssets: [campaignAssetSchema],
  tone: {
    type: String,
    enum: ['professional', 'casual', 'friendly', 'authoritative', 'conversational'],
    default: 'professional'
  },
  aiProvider: {
    type: String,
    enum: ['openai', 'gemini'],
    default: 'gemini'
  },
  status: {
    type: String,
    enum: ['draft', 'in_progress', 'completed', 'archived'],
    default: 'draft',
    index: true
  },
  progress: {
    totalAssets: {
      type: Number,
      default: 0,
      min: 0
    },
    completedAssets: {
      type: Number,
      default: 0,
      min: 0
    },
    percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    }
  },
  completedAt: {
    type: Date
  }
}, {
  timestamps: true,
  versionKey: false
});

// Índices compuestos para optimizar consultas
campaignSchema.index({ business: 1, status: 1 });
campaignSchema.index({ business: 1, createdAt: -1 });
campaignSchema.index({ brandScript: 1 });

// Middleware pre-save para calcular progreso
campaignSchema.pre('save', function(next) {
  const campaign = this as ICampaign;
  
  // Calcular progreso basado en assets completados
  const totalAssets = campaign.selectedAssets.length;
  const completedAssets = campaign.generatedAssets.filter(asset => asset.status === 'completed').length;
  
  campaign.progress = {
    totalAssets,
    completedAssets,
    percentage: totalAssets > 0 ? Math.round((completedAssets / totalAssets) * 100) : 0
  };
  
  // Actualizar estado basado en progreso
  if (campaign.progress.percentage === 100 && campaign.status === 'in_progress') {
    campaign.status = 'completed';
    campaign.completedAt = new Date();
  }
  
  next();
});

// Métodos de instancia
campaignSchema.methods.isComplete = function(): boolean {
  return this.progress.percentage === 100;
};

campaignSchema.methods.getNextPendingAsset = function(): string | null {
  const pendingAsset = this.generatedAssets.find((asset: ICampaignAsset) => asset.status === 'pending');
  return pendingAsset ? pendingAsset.type : null;
};

campaignSchema.methods.updateAssetStatus = function(assetType: string, status: string, content?: string, errorMessage?: string) {
  const asset = this.generatedAssets.find((a: any) => a.type === assetType);
  if (asset) {
    asset.status = status;
    if (content) {
      asset.content = content;
      asset.generatedAt = new Date();
      
      // Calcular metadata
      asset.metadata = {
        wordCount: content.split(/\s+/).length,
        characterCount: content.length,
        estimatedReadTime: Math.ceil(content.split(/\s+/).length / 200) // 200 words per minute
      };
    }
    if (errorMessage) {
      asset.errorMessage = errorMessage;
    }
    return true;
  }
  return false;
};

// Métodos estáticos
campaignSchema.statics.findByBusiness = function(businessId: string) {
  return this.find({ business: businessId }).sort({ createdAt: -1 });
};

campaignSchema.statics.findByBrandScript = function(brandScriptId: string) {
  return this.find({ brandScript: brandScriptId }).sort({ createdAt: -1 });
};

export const Campaign = model<ICampaign>('Campaign', campaignSchema);
export default Campaign;