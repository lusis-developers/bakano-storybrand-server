import { Schema, model, Document, Types } from 'mongoose';
import {
  UserRole,
  BusinessType,
  ContentCreatorType,
  StoryBrandGoal,
  StoryBrandFamiliarity,
  MarketingChannel
} from '../enums/onboarding.enum';

export interface IOnboardingContext extends Document {
  business: Types.ObjectId;
  
  // Pregunta 1: Rol del usuario
  userRole: UserRole;
  businessTypes?: BusinessType[]; // Solo si es business owner
  
  // Pregunta 2: Tipo de creador de contenido
  contentCreatorType: ContentCreatorType;
  
  // Pregunta 3: Objetivos con StoryBrand
  storyBrandGoals: StoryBrandGoal[];
  otherGoal?: string; // Si selecciona "Other"
  
  // Pregunta 4: Familiaridad con StoryBrand
  storyBrandFamiliarity: StoryBrandFamiliarity;
  
  // Pregunta 5: Canales de marketing actuales
  currentMarketingChannels: MarketingChannel[];
  
  // Virtual: Resumen del contexto
  contextSummary: {
    role: UserRole;
    businessTypes: BusinessType[];
    contentType: ContentCreatorType;
    goals: StoryBrandGoal[];
    familiarity: StoryBrandFamiliarity;
    channels: MarketingChannel[];
    isComplete: boolean;
  };
  
  // Metadatos
  completedAt: Date;
  isComplete: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const onboardingContextSchema = new Schema<IOnboardingContext>({
  business: {
    type: Schema.Types.ObjectId,
    ref: 'Business',
    required: [true, 'Business reference is required'],
    unique: true // Un contexto por business
  },
  
  userRole: {
    type: String,
    enum: Object.values(UserRole),
    required: [true, 'User role is required']
  },
  
  businessTypes: [{
    type: String,
    enum: Object.values(BusinessType)
  }],
  
  contentCreatorType: {
    type: String,
    enum: Object.values(ContentCreatorType),
    required: [true, 'Content creator type is required']
  },
  
  storyBrandGoals: [{
    type: String,
    enum: Object.values(StoryBrandGoal),
    required: true
  }],
  
  otherGoal: {
    type: String,
    trim: true,
    maxlength: [200, 'Other goal cannot exceed 200 characters']
  },
  
  storyBrandFamiliarity: {
    type: String,
    enum: Object.values(StoryBrandFamiliarity),
    required: [true, 'StoryBrand familiarity is required']
  },
  
  currentMarketingChannels: [{
    type: String,
    enum: Object.values(MarketingChannel),
    required: true
  }],
  
  completedAt: {
    type: Date,
    default: Date.now
  },
  
  isComplete: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  versionKey: false,
});

// Índices para optimizar consultas
onboardingContextSchema.index({ business: 1 });
onboardingContextSchema.index({ isComplete: 1 });
onboardingContextSchema.index({ completedAt: -1 });

// Middleware para marcar como completo cuando se tienen todos los campos requeridos
onboardingContextSchema.pre('save', function(next) {
  if (this.userRole && 
      this.contentCreatorType && 
      this.storyBrandGoals && 
      this.storyBrandGoals.length > 0 &&
      this.storyBrandFamiliarity &&
      this.currentMarketingChannels &&
      this.currentMarketingChannels.length > 0) {
    this.isComplete = true;
    this.completedAt = new Date();
  }
  next();
});

// Virtual para obtener un resumen del contexto
onboardingContextSchema.virtual('contextSummary').get(function() {
  return {
    role: this.userRole,
    businessTypes: this.businessTypes || [],
    contentType: this.contentCreatorType,
    goals: this.storyBrandGoals,
    familiarity: this.storyBrandFamiliarity,
    channels: this.currentMarketingChannels,
    isComplete: this.isComplete
  };
});

// Método para validar si el contexto está completo
onboardingContextSchema.methods.validateCompletion = function(): boolean {
  const requiredFields = [
    this.userRole,
    this.contentCreatorType,
    this.storyBrandFamiliarity
  ];
  
  const hasRequiredArrays = 
    this.storyBrandGoals && this.storyBrandGoals.length > 0 &&
    this.currentMarketingChannels && this.currentMarketingChannels.length > 0;
  
  return requiredFields.every(field => field !== undefined && field !== null) && hasRequiredArrays;
};

// Método para generar prompt personalizado para IA
onboardingContextSchema.methods.generateAIPrompt = function(): string {
  const context = this.contextSummary;
  
  let prompt = `Contexto del usuario para personalizar el BrandScript:\n`;
  prompt += `- Rol: ${context.role}\n`;
  
  if (context.businessTypes.length > 0) {
    prompt += `- Tipos de negocio: ${context.businessTypes.join(', ')}\n`;
  }
  
  prompt += `- Creador de contenido: ${context.contentType}\n`;
  prompt += `- Objetivos: ${context.goals.join(', ')}\n`;
  prompt += `- Familiaridad con StoryBrand: ${context.familiarity}\n`;
  prompt += `- Canales de marketing actuales: ${context.channels.join(', ')}\n`;
  
  return prompt;
};

onboardingContextSchema.set('toJSON', { virtuals: true });
onboardingContextSchema.set('toObject', { virtuals: true });

export const OnboardingContext = model<IOnboardingContext>('OnboardingContext', onboardingContextSchema);

export default OnboardingContext;