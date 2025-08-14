import { Schema, model, Document, Types } from 'mongoose';

// Interface for business questions
export interface IBusinessQuestions {
  companyName: string;
  productsServices: string;
  targetAudience: string;
  mainProblem: string;
  solution: string;
  uniqueCharacteristics: string;
  authority: string;
  steps: string;
}

// Interface for generated soundbites
export interface ISoundbite {
  text: string;
  category: 'primary' | 'secondary' | 'supporting';
  generatedAt: Date;
}

// Interface for generated taglines
export interface ITagline {
  text: string;
  style: 'professional' | 'casual' | 'creative' | 'direct';
  generatedAt: Date;
}

// Interface for generated scripts
export interface IScript {
  type: 'content' | 'ad';
  title: string;
  content: string;
  duration?: string;
  platform?: 'youtube' | 'instagram' | 'tiktok' | 'email' | 'website' | 'social';
  selectedSoundbite?: string;
  selectedTagline?: string;
  completed: boolean;
  generatedAt: Date;
}

// Main Content interface
export interface IContent extends Document {
  business: Types.ObjectId;
  questions: IBusinessQuestions;
  soundbites: ISoundbite[];
  taglines: ITagline[];
  scripts: IScript[];
  aiProvider: 'openai' | 'gemini';
  tone: string;
  status: 'draft' | 'questions_completed' | 'content_generated' | 'completed';
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  isQuestionsComplete(): boolean;
  hasGeneratedContent(): boolean;
}

// Schema for business questions
const questionsSchema = new Schema({
  companyName: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'Company name cannot exceed 100 characters']
  },
  productsServices: {
    type: String,
    required: true,
    trim: true,
    maxlength: [500, 'Products/services description cannot exceed 500 characters']
  },
  targetAudience: {
    type: String,
    required: true,
    trim: true,
    maxlength: [300, 'Target audience cannot exceed 300 characters']
  },
  mainProblem: {
    type: String,
    required: true,
    trim: true,
    maxlength: [400, 'Main problem cannot exceed 400 characters']
  },
  solution: {
    type: String,
    required: true,
    trim: true,
    maxlength: [400, 'Solution cannot exceed 400 characters']
  },
  uniqueCharacteristics: {
    type: String,
    required: true,
    trim: true,
    maxlength: [300, 'Unique characteristics cannot exceed 300 characters']
  },
  authority: {
    type: String,
    required: true,
    trim: true,
    maxlength: [300, 'Authority cannot exceed 300 characters']
  },
  steps: {
    type: String,
    required: true,
    trim: true,
    maxlength: [400, 'Steps cannot exceed 400 characters']
  }
}, { _id: false });

// Schema for soundbites
const soundbiteSchema = new Schema({
  text: {
    type: String,
    required: true,
    trim: true,
    maxlength: [200, 'Soundbite cannot exceed 200 characters']
  },
  category: {
    type: String,
    enum: ['primary', 'secondary', 'supporting'],
    required: true
  },
  generatedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

// Schema for taglines
const taglineSchema = new Schema({
  text: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'Tagline cannot exceed 100 characters']
  },
  style: {
    type: String,
    enum: ['professional', 'casual', 'creative', 'direct'],
    required: true
  },
  generatedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

// Schema for scripts
const scriptSchema = new Schema({
  type: {
    type: String,
    enum: ['content', 'ad'],
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'Script title cannot exceed 100 characters']
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  duration: {
    type: String,
    trim: true
  },
  platform: {
    type: String,
    enum: ['youtube', 'instagram', 'tiktok', 'email', 'website', 'social']
  },
  selectedSoundbite: {
    type: String,
    trim: true
  },
  selectedTagline: {
    type: String,
    trim: true
  },
  completed: {
    type: Boolean,
    default: false
  },
  generatedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

// Main Content schema
const contentSchema = new Schema<IContent>({
  business: {
    type: Schema.Types.ObjectId,
    ref: 'Business',
    required: true,
    index: true
  },
  
  questions: {
    type: questionsSchema,
    required: true
  },
  
  soundbites: [soundbiteSchema],
  taglines: [taglineSchema],
  scripts: [scriptSchema],
  
  aiProvider: {
    type: String,
    enum: ['openai', 'gemini'],
    default: 'gemini'
  },
  
  tone: {
    type: String,
    default: 'professional'
  },
  
  status: {
    type: String,
    enum: ['draft', 'questions_completed', 'content_generated', 'completed'],
    default: 'draft',
    index: true
  },
  
  completedAt: {
    type: Date
  }
}, {
  timestamps: true,
  versionKey: false
});

// Indexes
contentSchema.index({ business: 1, status: 1 });
contentSchema.index({ business: 1, createdAt: -1 });
contentSchema.index({ createdAt: -1 });

// Methods
contentSchema.methods.isQuestionsComplete = function(): boolean {
  const questions = this.questions;
  return !!(questions.companyName && 
           questions.productsServices && 
           questions.targetAudience && 
           questions.mainProblem && 
           questions.solution && 
           questions.uniqueCharacteristics && 
           questions.authority && 
           questions.steps);
};

contentSchema.methods.hasGeneratedContent = function(): boolean {
  return this.soundbites.length > 0 || this.taglines.length > 0;
};

// Pre-save middleware
contentSchema.pre('save', function(next) {
  if (this.isQuestionsComplete()) {
    if (this.status === 'draft') {
      this.status = 'questions_completed';
    }
  }
  
  if (this.hasGeneratedContent()) {
    if (this.status === 'questions_completed') {
      this.status = 'content_generated';
    }
  }
  
  if (this.scripts.length > 0 && this.status === 'content_generated') {
    this.status = 'completed';
    this.completedAt = new Date();
  }
  
  next();
});

const Content = model<IContent>('Content', contentSchema);

export default Content;