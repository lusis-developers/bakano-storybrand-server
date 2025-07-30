import { Schema, model, Document, Types } from 'mongoose';

// Interface for user professional profile
export interface IUserProfile {
  jobTitle: string;
  department: 'marketing' | 'sales' | 'operations' | 'executive' | 'other';
  experienceLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  marketingExperience: 'none' | 'basic' | 'intermediate' | 'advanced';
  primaryGoals: ('brand_awareness' | 'lead_generation' | 'sales_conversion' | 'customer_retention' | 'market_expansion')[];
  painPoints: ('lack_of_time' | 'limited_budget' | 'no_marketing_expertise' | 'unclear_messaging' | 'low_conversion_rates')[];
  preferredCommunicationStyle: 'formal' | 'casual' | 'technical' | 'creative';
  timezone: string;
  workingHours: {
    start: string; // HH:MM format
    end: string;   // HH:MM format
  };
}

// Interface for business context
export interface IBusinessContext {
  businessStage: 'startup' | 'growth' | 'established' | 'enterprise';
  companySize: '1-10' | '11-50' | '51-200' | '201-1000' | '1000+';
  targetMarket: 'b2b' | 'b2c' | 'both';
  primaryIndustry: string;
  secondaryIndustries: string[];
  geographicMarkets: string[]; // Countries/regions
  competitiveAdvantage: string;
  brandMaturity: 'new_brand' | 'developing' | 'established' | 'mature';
  marketingBudget: 'under_1k' | '1k_5k' | '5k_25k' | '25k_100k' | 'over_100k';
  currentMarketingChannels: ('social_media' | 'email' | 'content_marketing' | 'paid_ads' | 'seo' | 'events' | 'partnerships' | 'traditional')[];
  marketingChallenges: ('inconsistent_messaging' | 'low_engagement' | 'poor_conversion' | 'limited_reach' | 'high_costs' | 'measuring_roi')[];
  contentCreationFrequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'as_needed';
  brandVoice: 'professional' | 'friendly' | 'authoritative' | 'innovative' | 'trustworthy' | 'playful';
}

// Interface for onboarding preferences
export interface IOnboardingPreferences {
  communicationFrequency: 'daily' | 'weekly' | 'monthly' | 'as_needed';
  preferredContentTypes: ('blog_posts' | 'social_media' | 'email_campaigns' | 'video_scripts' | 'ad_copy' | 'website_copy')[];
  aiProviderPreference: 'openai' | 'gemini' | 'no_preference';
  notificationSettings: {
    email: boolean;
    inApp: boolean;
    contentGenerated: boolean;
    weeklyReports: boolean;
    systemUpdates: boolean;
  };
  onboardingCompleted: boolean;
  completedSteps: ('user_profile' | 'business_context' | 'preferences' | 'first_content')[];
}

// Main Onboarding interface
export interface IOnboarding extends Document {
  user: Types.ObjectId;
  business: Types.ObjectId;
  userProfile: IUserProfile;
  businessContext: IBusinessContext;
  preferences: IOnboardingPreferences;
  completionPercentage: number;
  startedAt: Date;
  completedAt?: Date;
  lastUpdated: Date;
  createdAt: Date;
  updatedAt: Date;
  isComplete(): boolean;
  getNextStep(): string | null;
  calculateCompletionPercentage(): number;
}

// User Profile Schema
const userProfileSchema = new Schema({
  jobTitle: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'Job title cannot exceed 100 characters']
  },
  department: {
    type: String,
    enum: ['marketing', 'sales', 'operations', 'executive', 'other'],
    required: true
  },
  experienceLevel: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced', 'expert'],
    required: true
  },
  marketingExperience: {
    type: String,
    enum: ['none', 'basic', 'intermediate', 'advanced'],
    required: true
  },
  primaryGoals: [{
    type: String,
    enum: ['brand_awareness', 'lead_generation', 'sales_conversion', 'customer_retention', 'market_expansion']
  }],
  painPoints: [{
    type: String,
    enum: ['lack_of_time', 'limited_budget', 'no_marketing_expertise', 'unclear_messaging', 'low_conversion_rates']
  }],
  preferredCommunicationStyle: {
    type: String,
    enum: ['formal', 'casual', 'technical', 'creative'],
    default: 'professional'
  },
  timezone: {
    type: String,
    required: true,
    default: 'UTC'
  },
  workingHours: {
    start: {
      type: String,
      required: true,
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format. Use HH:MM']
    },
    end: {
      type: String,
      required: true,
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format. Use HH:MM']
    }
  }
}, { _id: false });

// Business Context Schema
const businessContextSchema = new Schema({
  businessStage: {
    type: String,
    enum: ['startup', 'growth', 'established', 'enterprise'],
    required: true
  },
  companySize: {
    type: String,
    enum: ['1-10', '11-50', '51-200', '201-1000', '1000+'],
    required: true
  },
  targetMarket: {
    type: String,
    enum: ['b2b', 'b2c', 'both'],
    required: true
  },
  primaryIndustry: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'Primary industry cannot exceed 100 characters']
  },
  secondaryIndustries: [{
    type: String,
    trim: true,
    maxlength: [100, 'Industry name cannot exceed 100 characters']
  }],
  geographicMarkets: [{
    type: String,
    trim: true,
    maxlength: [100, 'Geographic market cannot exceed 100 characters']
  }],
  competitiveAdvantage: {
    type: String,
    required: true,
    trim: true,
    maxlength: [500, 'Competitive advantage cannot exceed 500 characters']
  },
  brandMaturity: {
    type: String,
    enum: ['new_brand', 'developing', 'established', 'mature'],
    required: true
  },
  marketingBudget: {
    type: String,
    enum: ['under_1k', '1k_5k', '5k_25k', '25k_100k', 'over_100k'],
    required: true
  },
  currentMarketingChannels: [{
    type: String,
    enum: ['social_media', 'email', 'content_marketing', 'paid_ads', 'seo', 'events', 'partnerships', 'traditional']
  }],
  marketingChallenges: [{
    type: String,
    enum: ['inconsistent_messaging', 'low_engagement', 'poor_conversion', 'limited_reach', 'high_costs', 'measuring_roi']
  }],
  contentCreationFrequency: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'quarterly', 'as_needed'],
    required: true
  },
  brandVoice: {
    type: String,
    enum: ['professional', 'friendly', 'authoritative', 'innovative', 'trustworthy', 'playful'],
    required: true
  }
}, { _id: false });

// Preferences Schema
const preferencesSchema = new Schema({
  communicationFrequency: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'as_needed'],
    default: 'weekly'
  },
  preferredContentTypes: [{
    type: String,
    enum: ['blog_posts', 'social_media', 'email_campaigns', 'video_scripts', 'ad_copy', 'website_copy']
  }],
  aiProviderPreference: {
    type: String,
    enum: ['openai', 'gemini', 'no_preference'],
    default: 'no_preference'
  },
  notificationSettings: {
    email: { type: Boolean, default: true },
    inApp: { type: Boolean, default: true },
    contentGenerated: { type: Boolean, default: true },
    weeklyReports: { type: Boolean, default: true },
    systemUpdates: { type: Boolean, default: false }
  },
  onboardingCompleted: {
    type: Boolean,
    default: false
  },
  completedSteps: [{
    type: String,
    enum: ['user_profile', 'business_context', 'preferences', 'first_content']
  }]
}, { _id: false });

// Main Onboarding Schema
const onboardingSchema = new Schema<IOnboarding>({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  business: {
    type: Schema.Types.ObjectId,
    ref: 'Business',
    required: true,
    index: true
  },
  userProfile: {
    type: userProfileSchema,
    required: true
  },
  businessContext: {
    type: businessContextSchema,
    required: true
  },
  preferences: {
    type: preferencesSchema,
    default: () => ({})
  },
  completionPercentage: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  versionKey: false
});

// Indexes
onboardingSchema.index({ user: 1, business: 1 }, { unique: true });
onboardingSchema.index({ completionPercentage: 1 });
onboardingSchema.index({ 'preferences.onboardingCompleted': 1 });

// Methods
onboardingSchema.methods.isComplete = function(): boolean {
  return this.preferences.onboardingCompleted && this.completionPercentage === 100;
};

onboardingSchema.methods.getNextStep = function(): string | null {
  const allSteps = ['user_profile', 'business_context', 'preferences', 'first_content'];
  const completedSteps = this.preferences.completedSteps || [];
  
  for (const step of allSteps) {
    if (!completedSteps.includes(step)) {
      return step;
    }
  }
  
  return null;
};

onboardingSchema.methods.calculateCompletionPercentage = function(): number {
  const totalSteps = 4; // user_profile, business_context, preferences, first_content
  const completedSteps = this.preferences.completedSteps?.length || 0;
  return Math.round((completedSteps / totalSteps) * 100);
};

// Pre-save middleware to update completion percentage
onboardingSchema.pre('save', function(next) {
  this.completionPercentage = this.calculateCompletionPercentage();
  this.lastUpdated = new Date();
  
  if (this.completionPercentage === 100 && !this.completedAt) {
    this.completedAt = new Date();
    this.preferences.onboardingCompleted = true;
  }
  
  next();
});

const Onboarding = model<IOnboarding>('Onboarding', onboardingSchema);

export default Onboarding;