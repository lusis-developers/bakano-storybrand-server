import { Types } from 'mongoose';
import models from '../models';
import geminiService from './gemini.service';
import openaiService from './openai.service';
import type { IBrandScript } from '../models/brandscript.model';

/**
 * Interfaz para las respuestas del cuestionario
 */
interface BrandScriptAnswers {
  companyName: string;
  productsServices: string;
  targetAudience: string;
  mainProblem: string;
  solution: string;
  uniqueCharacteristics: string;
  authority: string;
  steps: string;
}

/**
 * Interfaz para los parámetros de creación de BrandScript
 */
interface CreateBrandScriptParams {
  businessId: string;
  answers: BrandScriptAnswers;
  aiProvider?: 'gemini' | 'openai';
  userId: string;
}

/**
 * Interfaz para los parámetros de paginación
 */
interface PaginationParams {
  page?: number;
  limit?: number;
  businessId?: string;
  status?: string;
}

/**
 * Interfaz para el resultado de paginación
 */
interface PaginatedResult<T> {
  data: T[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
}

class BrandScriptService {
  /**
   * Validar que el negocio existe y pertenece al usuario
   */
  async validateBusinessOwnership(businessId: string, userId: string) {
    const business = await models.business.findOne({
      _id: businessId,
      owner: userId
    });

    if (!business) {
      throw new Error('Negocio no encontrado o no tienes permisos para acceder a él');
    }

    return business;
  }

  /**
   * Validar campos requeridos del cuestionario
   */
  validateRequiredAnswers(answers: BrandScriptAnswers) {
    const requiredFields: (keyof BrandScriptAnswers)[] = [
      'companyName', 'productsServices', 'targetAudience',
      'mainProblem', 'solution', 'uniqueCharacteristics',
      'authority', 'steps'
    ];

    for (const field of requiredFields) {
      if (!answers[field] || answers[field].trim() === '') {
        throw new Error(`El campo '${field}' es requerido`);
      }
    }
  }

  /**
   * Generar BrandScript usando IA
   */
  async generateBrandScriptWithAI(answers: BrandScriptAnswers, aiProvider: 'gemini' | 'openai' = 'gemini') {
    try {
      if (aiProvider === 'gemini') {
        const generatedJson = await geminiService.generateBrandScript(answers);
        // Limpiar la respuesta de Gemini (remover bloques de código markdown)
        const cleanedJson = generatedJson
          .replace(/```json\s*/g, '')
          .replace(/```\s*/g, '')
          .trim();
        // Parsear el JSON limpio
        return JSON.parse(cleanedJson);
      } else {
        throw new Error('Por ahora solo se soporta el proveedor Gemini');
      }
    } catch (error) {
      console.error('Error generando BrandScript con IA:', error);
      throw new Error('Error al generar el BrandScript con IA');
    }
  }

  /**
   * Crear un nuevo BrandScript
   */
  async createBrandScript(params: CreateBrandScriptParams): Promise<IBrandScript> {
    const { businessId, answers, aiProvider = 'gemini', userId } = params;

    // Validaciones
    await this.validateBusinessOwnership(businessId, userId);
    this.validateRequiredAnswers(answers);

    // Generar BrandScript con IA
    const brandScriptData = await this.generateBrandScriptWithAI(answers, aiProvider);

    // Crear el BrandScript en la base de datos
    const brandScript = new models.brandscript({
      business: businessId,
      answers,
      // Campos directos del JSON generado por Gemini
      controllingIdea: brandScriptData.controllingIdea || '',
      characterWhatTheyWant: brandScriptData.characterWhatTheyWant || '',
      problemExternal: brandScriptData.problemExternal || '',
      problemInternal: brandScriptData.problemInternal || '',
      problemPhilosophical: brandScriptData.problemPhilosophical || '',
      guideEmpathy: brandScriptData.guideEmpathy || '',
      guideCompetencyAndAuthority: brandScriptData.guideCompetencyAndAuthority || '',
      planProcessSteps: brandScriptData.planProcessSteps || [],
      callToActionDirect: brandScriptData.callToActionDirect || '',
      callToActionTransitional: brandScriptData.callToActionTransitional || '',
      successResults: brandScriptData.successResults || '',
      failureResults: brandScriptData.failureResults || '',
      transformationFrom: brandScriptData.transformationFrom || '',
      transformationTo: brandScriptData.transformationTo || '',
      aiProvider,
      status: 'completed'
    });

    await brandScript.save();
    await brandScript.populate('business', 'name owner');

    return brandScript;
  }

  /**
   * Obtener BrandScripts paginados de un usuario
   */
  async getBrandScriptsByUser(userId: string, params: PaginationParams): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 10, businessId, status } = params;

    // Construir filtros
    const matchStage: any = {
      'business.owner': new Types.ObjectId(userId)
    };

    if (businessId) {
      matchStage.business = new Types.ObjectId(businessId);
    }

    if (status) {
      matchStage.status = status;
    }

    // Pipeline de agregación
    const pipeline: any[] = [
      {
        $lookup: {
          from: 'businesses',
          localField: 'business',
          foreignField: '_id',
          as: 'business'
        }
      },
      {
        $unwind: '$business'
      },
      {
        $match: matchStage
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $skip: (Number(page) - 1) * Number(limit)
      },
      {
        $limit: Number(limit)
      },
      {
        $project: {
          'answers': 1,
          'controllingIdea': 1,
          'characterWhatTheyWant': 1,
          'problemExternal': 1,
          'guideEmpathy': 1,
          'planProcessSteps': 1,
          'callToActionDirect': 1,
          'aiProvider': 1,
          'status': 1,
          'version': 1,
          'marketingAssets': 1,
          'createdAt': 1,
          'updatedAt': 1,
          'business.name': 1,
          'business._id': 1
        }
      }
    ];

    const brandScripts = await models.brandscript.aggregate(pipeline);

    // Contar total para paginación
    const totalPipeline: any[] = [
      {
        $lookup: {
          from: 'businesses',
          localField: 'business',
          foreignField: '_id',
          as: 'business'
        }
      },
      {
        $unwind: '$business'
      },
      {
        $match: matchStage
      },
      {
        $count: 'total'
      }
    ];

    const totalResult = await models.brandscript.aggregate(totalPipeline);
    const total = totalResult[0]?.total || 0;

    return {
      data: brandScripts,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        totalItems: total,
        itemsPerPage: Number(limit)
      }
    };
  }

  /**
   * Obtener un BrandScript por ID con validación de permisos
   */
  async getBrandScriptById(id: string, userId: string): Promise<IBrandScript> {
    const brandScript = await models.brandscript.findById(id)
      .populate({
        path: 'business',
        select: 'name owner',
        match: { owner: userId }
      });

    if (!brandScript || !brandScript.business) {
      throw new Error('BrandScript no encontrado o no tienes permisos para acceder a él');
    }

    return brandScript;
  }

  /**
   * Crear resumen del BrandScript para contenido de marketing
   */
  createMarketingSummary(brandScript: IBrandScript): string {
    return `
Idea Controladora: ${brandScript.controllingIdea}
Personaje: ${brandScript.characterWhatTheyWant}
Problema: ${brandScript.problemExternal}
Guía: ${brandScript.guideEmpathy}
Plan: ${Array.isArray(brandScript.planProcessSteps) ? brandScript.planProcessSteps.join(', ') : brandScript.planProcessSteps}
Llamada a la Acción: ${brandScript.callToActionDirect}
Éxito: ${brandScript.successResults}
`;
  }

  /**
   * Crear resumen completo del BrandScript para análisis
   */
  createAnalysisSummary(brandScript: IBrandScript): string {
    return `
Idea Controladora: ${brandScript.controllingIdea}
Personaje: ${brandScript.characterWhatTheyWant}
Problema Externo: ${brandScript.problemExternal}
Problema Interno: ${brandScript.problemInternal}
Problema Filosófico: ${brandScript.problemPhilosophical}
Guía - Empatía: ${brandScript.guideEmpathy}
Guía - Autoridad: ${brandScript.guideCompetencyAndAuthority}
Plan: ${Array.isArray(brandScript.planProcessSteps) ? brandScript.planProcessSteps.join(', ') : brandScript.planProcessSteps}
Llamada Directa: ${brandScript.callToActionDirect}
Llamada Transicional: ${brandScript.callToActionTransitional}
Éxito: ${brandScript.successResults}
Fracaso: ${brandScript.failureResults}
Transformación De: ${brandScript.transformationFrom}
Transformación A: ${brandScript.transformationTo}
`;
  }

  /**
   * Generar contenido de marketing
   */
  async generateMarketingContent(
    brandScript: IBrandScript,
    contentType: 'email' | 'landing' | 'social' | 'elevator',
    aiProvider?: 'gemini' | 'openai'
  ): Promise<string> {
    const provider = aiProvider || brandScript.aiProvider;
    const brandScriptSummary = this.createMarketingSummary(brandScript);

    try {
      if (provider === 'gemini') {
        return await geminiService.generateMarketingContent(brandScriptSummary, contentType);
      } else {
        return await openaiService.generateMarketingContent(brandScriptSummary, contentType);
      }
    } catch (error) {
      console.error('Error generando contenido de marketing:', error);
      throw new Error('Error al generar el contenido de marketing');
    }
  }

  /**
   * Actualizar BrandScript con contenido de marketing
   */
  async updateMarketingContent(
    id: string,
    contentType: 'email' | 'landing' | 'social' | 'elevator',
    content: string
  ): Promise<void> {
    const updateField = `marketingAssets.${contentType === 'landing' ? 'landingPage' : contentType === 'social' ? 'socialPosts' : contentType === 'elevator' ? 'elevatorPitch' : 'email'}`;

    await models.brandscript.findByIdAndUpdate(
      id,
      { $set: { [updateField]: content } },
      { new: true }
    );
  }

  /**
   * Analizar BrandScript con IA
   */
  async analyzeBrandScript(
    brandScript: IBrandScript,
    aiProvider?: 'gemini' | 'openai'
  ): Promise<string> {
    const provider = aiProvider || 'gemini';

    if (provider === 'gemini') {
      const brandScriptSummary = this.createAnalysisSummary(brandScript);
      try {
        return await geminiService.analyzeBrandScript(brandScriptSummary);
      } catch (error) {
        console.error('Error analizando BrandScript:', error);
        throw new Error('Error al analizar el BrandScript');
      }
    } else {
      throw new Error('El análisis de BrandScript solo está disponible con Gemini por ahora');
    }
  }

  /**
   * Guardar análisis en el BrandScript
   */
  async saveAnalysis(id: string, analysis: string): Promise<void> {
    await models.brandscript.findByIdAndUpdate(
      id,
      { $set: { analysis } },
      { new: true }
    );
  }

  /**
   * Actualizar estado del BrandScript
   */
  async updateStatus(
    id: string,
    status: 'draft' | 'completed' | 'archived',
    userId: string
  ): Promise<IBrandScript> {
    const brandScript = await models.brandscript.findOneAndUpdate(
      {
        _id: id,
        business: {
          $in: await models.business.find({ owner: userId }).distinct('_id')
        }
      },
      { status },
      { new: true }
    ).populate('business', 'name owner');

    if (!brandScript) {
      throw new Error('BrandScript no encontrado o no tienes permisos para modificarlo');
    }

    return brandScript;
  }

  /**
   * Eliminar BrandScript
   */
  async deleteBrandScript(id: string, userId: string): Promise<void> {
    const brandScript = await models.brandscript.findOneAndDelete({
      _id: id,
      business: {
        $in: await models.business.find({ owner: userId }).distinct('_id')
      }
    });

    if (!brandScript) {
      throw new Error('BrandScript no encontrado o no tienes permisos para eliminarlo');
    }
  }

  /**
   * Validar tipo de contenido de marketing
   */
  validateContentType(contentType: string): contentType is 'email' | 'landing' | 'social' | 'elevator' {
    const validContentTypes = ['email', 'landing', 'social', 'elevator'];
    return validContentTypes.includes(contentType);
  }

  /**
   * Validar estado del BrandScript
   */
  validateStatus(status: string): status is 'draft' | 'completed' | 'archived' {
    const validStatuses = ['draft', 'completed', 'archived'];
    return validStatuses.includes(status);
  }
}

export default new BrandScriptService();