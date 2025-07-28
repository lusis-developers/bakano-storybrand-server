import { Schema, model, Document, Types } from 'mongoose';

// Interface para las respuestas del cuestionario
interface IBrandScriptAnswers {
  companyName: string;
  productsServices: string;
  targetAudience: string;
  mainProblem: string;
  solution: string;
  uniqueCharacteristics: string;
  authority: string;
  steps: string;
}

// Interface simplificada para el BrandScript - coincide exactamente con la imagen
export interface IBrandScript extends Document {
  business: Types.ObjectId;
  answers: IBrandScriptAnswers;
  
  // Campos directos del BrandScript según la imagen
  controllingIdea: string;
  
  // 01 - A Character
  characterWhatTheyWant: string;
  
  // 02 - With a Problem  
  problemExternal: string;
  problemInternal: string;
  problemPhilosophical: string;
  
  // 03 - Meets a Guide
  guideEmpathy: string;
  guideCompetencyAndAuthority: string;
  
  // 04 - Who Gives Them A Plan
  planProcessSteps: string[];
  
  // 05 - And Calls Them to Action
  callToActionDirect: string;
  callToActionTransitional: string;
  
  // 06A - Success
  successResults: string;
  
  // 06B - Failure
  failureResults: string;
  
  // 07 - Identity Transformation
  transformationFrom: string;
  transformationTo: string;
  
  // Metadatos
  aiProvider: 'openai' | 'gemini';
  status: 'draft' | 'completed' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

// Schema para las respuestas del cuestionario
const answersSchema = new Schema({
  companyName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  productsServices: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  targetAudience: {
    type: String,
    required: true,
    trim: true,
    maxlength: 300
  },
  mainProblem: {
    type: String,
    required: true,
    trim: true,
    maxlength: 400
  },
  solution: {
    type: String,
    required: true,
    trim: true,
    maxlength: 400
  },
  uniqueCharacteristics: {
    type: String,
    required: true,
    trim: true,
    maxlength: 300
  },
  authority: {
    type: String,
    required: true,
    trim: true,
    maxlength: 300
  },
  steps: {
    type: String,
    required: true,
    trim: true,
    maxlength: 400
  }
}, { _id: false });

// Schema principal del BrandScript - simplificado
const brandScriptSchema = new Schema({
  business: {
    type: Schema.Types.ObjectId,
    ref: 'Business',
    required: true,
    index: true
  },
  answers: {
    type: answersSchema,
    required: true
  },
  
  // Controlling Idea
  controllingIdea: {
    type: String,
    default: '',
    trim: true
  },
  
  // 01 - A Character
  characterWhatTheyWant: {
    type: String,
    default: '',
    trim: true
  },
  
  // 02 - With a Problem
  problemExternal: {
    type: String,
    default: '',
    trim: true
  },
  problemInternal: {
    type: String,
    default: '',
    trim: true
  },
  problemPhilosophical: {
    type: String,
    default: '',
    trim: true
  },
  
  // 03 - Meets a Guide
  guideEmpathy: {
    type: String,
    default: '',
    trim: true
  },
  guideCompetencyAndAuthority: {
    type: String,
    default: '',
    trim: true
  },
  
  // 04 - Who Gives Them A Plan
  planProcessSteps: {
    type: [String],
    default: []
  },
  
  // 05 - And Calls Them to Action
  callToActionDirect: {
    type: String,
    default: '',
    trim: true
  },
  callToActionTransitional: {
    type: String,
    default: '',
    trim: true
  },
  
  // 06A - Success
  successResults: {
    type: String,
    default: '',
    trim: true
  },
  
  // 06B - Failure
  failureResults: {
    type: String,
    default: '',
    trim: true
  },
  
  // 07 - Identity Transformation
  transformationFrom: {
    type: String,
    default: '',
    trim: true
  },
  transformationTo: {
    type: String,
    default: '',
    trim: true
  },
  
  // Metadatos
  aiProvider: {
    type: String,
    enum: ['openai', 'gemini'],
    required: true,
    default: 'gemini'
  },
  status: {
    type: String,
    enum: ['draft', 'completed', 'archived'],
    default: 'completed',
    index: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices para optimización
brandScriptSchema.index({ business: 1 });
brandScriptSchema.index({ business: 1, status: 1 });
brandScriptSchema.index({ createdAt: -1 });

export const BrandScript = model<IBrandScript>('BrandScript', brandScriptSchema);
export default BrandScript;