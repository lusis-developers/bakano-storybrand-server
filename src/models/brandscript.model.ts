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

// Interface para las secciones parseadas del BrandScript
interface IBrandScriptSections {
  character: {
    title: string;
    number: string;
    content: {
      whatTheyWant: string;
      external: string;
      internal: string;
      philosophical: string;
    };
  };
  problem: {
    title: string;
    number: string;
    content: {
      external: string;
      internal: string;
      philosophical: string;
    };
  };
  guide: {
    title: string;
    number: string;
    content: {
      empathy: string;
      competencyAndAuthority: string;
    };
  };
  plan: {
    title: string;
    number: string;
    content: {
      processSteps: string[];
    };
  };
  callToAction: {
    title: string;
    number: string;
    content: {
      direct: string;
      transitional: string;
    };
  };
  success: {
    title: string;
    number: string;
    content: {
      successfulResults: string;
    };
  };
  failure: {
    title: string;
    number: string;
    content: {
      tragicResults: string;
    };
  };
  transformation: {
    title: string;
    number: string;
    content: {
      from: string;
      to: string;
    };
  };
}

// Interface para el documento de BrandScript
export interface IBrandScript extends Document {
  business: Types.ObjectId;
  answers: IBrandScriptAnswers;
  generatedScript: string;
  parsedScript?: IBrandScriptSections;
  aiProvider: 'openai' | 'gemini';
  status: 'draft' | 'completed' | 'archived';
  version: number;
  marketingAssets?: {
    email?: string;
    landingPage?: string;
    socialPosts?: string;
    elevatorPitch?: string;
  };
  analysis?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Schema para las respuestas
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

// Schema para los assets de marketing
const marketingAssetsSchema = new Schema({
  email: {
    type: String,
    trim: true
  },
  landingPage: {
    type: String,
    trim: true
  },
  socialPosts: {
    type: String,
    trim: true
  },
  elevatorPitch: {
    type: String,
    trim: true
  }
}, { _id: false });

// Schema para las secciones parseadas
const parsedScriptSchema = new Schema({
  character: {
    title: { type: String, default: "A Character" },
    number: { type: String, default: "01" },
    content: {
      whatTheyWant: { type: String, default: "" },
      external: { type: String, default: "" },
      internal: { type: String, default: "" },
      philosophical: { type: String, default: "" }
    }
  },
  problem: {
    title: { type: String, default: "With a Problem" },
    number: { type: String, default: "02" },
    content: {
      external: { type: String, default: "" },
      internal: { type: String, default: "" },
      philosophical: { type: String, default: "" }
    }
  },
  guide: {
    title: { type: String, default: "Meets a Guide" },
    number: { type: String, default: "03" },
    content: {
      empathy: { type: String, default: "" },
      competencyAndAuthority: { type: String, default: "" }
    }
  },
  plan: {
    title: { type: String, default: "Who Gives Them A Plan" },
    number: { type: String, default: "04" },
    content: {
      processSteps: [{ type: String }]
    }
  },
  callToAction: {
    title: { type: String, default: "And Calls Them to Action" },
    number: { type: String, default: "05" },
    content: {
      direct: { type: String, default: "" },
      transitional: { type: String, default: "" }
    }
  },
  success: {
    title: { type: String, default: "Success" },
    number: { type: String, default: "06A" },
    content: {
      successfulResults: { type: String, default: "" }
    }
  },
  failure: {
    title: { type: String, default: "Failure" },
    number: { type: String, default: "06B" },
    content: {
      tragicResults: { type: String, default: "" }
    }
  },
  transformation: {
    title: { type: String, default: "Identity Transformation" },
    number: { type: String, default: "07" },
    content: {
      from: { type: String, default: "" },
      to: { type: String, default: "" }
    }
  }
}, { _id: false });

// Schema principal del BrandScript
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
  generatedScript: {
    type: String,
    required: true,
    trim: true
  },
  parsedScript: {
    type: parsedScriptSchema,
    default: {}
  },
  aiProvider: {
    type: String,
    enum: ['openai', 'gemini'],
    required: true,
    default: 'openai'
  },
  status: {
    type: String,
    enum: ['draft', 'completed', 'archived'],
    default: 'draft',
    index: true
  },
  version: {
    type: Number,
    default: 1,
    min: 1
  },
  marketingAssets: {
    type: marketingAssetsSchema,
    default: {}
  },
  analysis: {
    type: String,
    trim: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices compuestos para optimizar consultas
brandScriptSchema.index({ business: 1, version: -1 });
brandScriptSchema.index({ business: 1, status: 1 });
brandScriptSchema.index({ createdAt: -1 });

// Virtual para obtener el nombre de la empresa desde las respuestas
brandScriptSchema.virtual('companyName').get(function(this: IBrandScript) {
  return this.answers?.companyName;
});

// Virtual para verificar si tiene assets de marketing
brandScriptSchema.virtual('hasMarketingAssets').get(function(this: IBrandScript) {
  const assets = this.marketingAssets;
  return !!(assets?.email || assets?.landingPage || assets?.socialPosts || assets?.elevatorPitch);
});

// Middleware pre-save para manejar versiones
brandScriptSchema.pre('save', async function(this: IBrandScript, next) {
  if (this.isNew) {
    // Para nuevos documentos, encontrar la versión más alta existente
    const latestVersion = await (this.constructor as any).findOne(
      { business: this.business },
      { version: 1 },
      { sort: { version: -1 } }
    );
    
    if (latestVersion) {
      this.version = (latestVersion as IBrandScript).version + 1;
    }
  }
  next();
});

// Método estático para obtener el BrandScript activo de un negocio
brandScriptSchema.statics.getActiveBrandScript = function(businessId: Types.ObjectId) {
  return this.findOne({
    business: businessId,
    status: { $in: ['draft', 'completed'] }
  })
  .populate('business', 'name owner')
  .sort({ version: -1 });
};

// Método estático para obtener todas las versiones de un negocio
brandScriptSchema.statics.getAllVersions = function(businessId: Types.ObjectId) {
  return this.find({ business: businessId })
    .populate('business', 'name owner')
    .sort({ version: -1 });
};

// Método de instancia para generar un resumen
brandScriptSchema.methods.getSummary = function(this: IBrandScript) {
  return {
    id: this._id,
    business: this.business,
    companyName: this.answers.companyName,
    status: this.status,
    version: this.version,
    aiProvider: this.aiProvider,
    hasMarketingAssets: !!(this.marketingAssets?.email || this.marketingAssets?.landingPage || this.marketingAssets?.socialPosts || this.marketingAssets?.elevatorPitch),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

export const BrandScript = model<IBrandScript>('BrandScript', brandScriptSchema);
export default BrandScript;