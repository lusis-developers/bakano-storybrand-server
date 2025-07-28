import type { Request, Response, NextFunction } from 'express';
import { HttpStatusCode } from 'axios';
import { Types } from 'mongoose';
import models from '../models';
import type { AuthRequest } from '../types/AuthRequest';
import openaiService from '../services/openai.service';
import geminiService from '../services/gemini.service';
import { parseBrandScriptSections } from '../utils/brandscript-parser.util';



/**
 * Crear un nuevo BrandScript
 */
export async function createBrandScriptController(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { businessId, answers, aiProvider = 'openai' } = req.body;
    const userId = req.user?.id;

    // Validar que el negocio existe y pertenece al usuario
    const business = await models.business.findOne({
      _id: businessId,
      owner: userId
    });

    if (!business) {
      res.status(HttpStatusCode.NotFound).send({
        success: false,
        message: 'Negocio no encontrado o no tienes permisos para acceder a él'
      });
      return;
    }

    // Validar respuestas requeridas
    const requiredFields = [
      'companyName', 'productsServices', 'targetAudience', 
      'mainProblem', 'solution', 'uniqueCharacteristics', 
      'authority', 'steps'
    ];

    for (const field of requiredFields) {
      if (!answers[field] || answers[field].trim() === '') {
        res.status(HttpStatusCode.BadRequest).send({
          success: false,
          message: `El campo '${field}' es requerido`
        });
        return;
      }
    }

    // Generar BrandScript con IA
    let generatedScript: string;
    try {
      if (aiProvider === 'gemini') {
        generatedScript = await geminiService.generateBrandScript(answers);
      } else {
        generatedScript = await openaiService.generateBrandScript(answers);
      }
    } catch (error) {
      console.error('Error generando BrandScript:', error);
      res.status(HttpStatusCode.InternalServerError).send({
        success: false,
        message: 'Error al generar el BrandScript con IA'
      });
      return;
    }

    // Parsear el script generado en secciones estructuradas
    const parsedScript = parseBrandScriptSections(generatedScript);

    // Crear el BrandScript en la base de datos
    const brandScript = new models.brandscript({
      business: businessId,
      answers,
      generatedScript,
      parsedScript,
      aiProvider,
      status: 'completed'
    });

    await brandScript.save();
    await brandScript.populate('business', 'name owner');

    res.status(HttpStatusCode.Created).send({
      success: true,
      message: 'BrandScript creado exitosamente',
      data: brandScript
    });

  } catch (error) {
    console.error('Error en createBrandScriptController:', error);
    next(error);
  }
}

/**
 * Obtener todos los BrandScripts de un usuario
 */
export async function getBrandScriptsController(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;
    const { page = 1, limit = 10, businessId, status } = req.query;

    // Construir filtros
    const matchStage: any = {
      'business.owner': new Types.ObjectId(userId)
    };

    if (businessId) {
      matchStage.business = new Types.ObjectId(businessId as string);
    }

    if (status) {
      matchStage.status = status;
    }

    // Pipeline de agregación para obtener BrandScripts con información del negocio
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
          'generatedScript': 1,
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

    res.status(HttpStatusCode.Ok).send({
      success: true,
      message: 'BrandScripts obtenidos exitosamente',
      data: {
        brandScripts,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
          totalItems: total,
          itemsPerPage: Number(limit)
        }
      }
    });

  } catch (error) {
    console.error('Error en getBrandScriptsController:', error);
    next(error);
  }
}

/**
 * Obtener un BrandScript específico
 */
export async function getBrandScriptByIdController(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const brandScript = await models.brandscript.findById(id)
      .populate({
        path: 'business',
        select: 'name owner',
        match: { owner: userId }
      });

    if (!brandScript || !brandScript.business) {
      res.status(HttpStatusCode.NotFound).send({
        success: false,
        message: 'BrandScript no encontrado o no tienes permisos para acceder a él'
      });
      return;
    }

    res.status(HttpStatusCode.Ok).send({
      success: true,
      message: 'BrandScript obtenido exitosamente',
      data: brandScript
    });

  } catch (error) {
    console.error('Error en getBrandScriptByIdController:', error);
    next(error);
  }
}

/**
 * Generar contenido de marketing basado en el BrandScript
 */
export async function generateMarketingContentController(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { contentType, aiProvider } = req.body;
    const userId = req.user?.id;

    // Validar tipo de contenido
    const validContentTypes = ['email', 'landing', 'social', 'elevator'];
    if (!validContentTypes.includes(contentType)) {
      res.status(HttpStatusCode.BadRequest).send({
        success: false,
        message: 'Tipo de contenido inválido. Debe ser: email, landing, social, o elevator'
      });
      return;
    }

    // Obtener el BrandScript
    const brandScript = await models.brandscript.findById(id)
      .populate({
        path: 'business',
        select: 'name owner',
        match: { owner: userId }
      });

    if (!brandScript || !brandScript.business) {
      res.status(HttpStatusCode.NotFound).send({
        success: false,
        message: 'BrandScript no encontrado o no tienes permisos para acceder a él'
      });
      return;
    }

    // Generar contenido con IA
    let generatedContent: string;
    try {
      const provider = aiProvider || brandScript.aiProvider;
      if (provider === 'gemini') {
        generatedContent = await geminiService.generateMarketingContent(
          brandScript.generatedScript,
          contentType
        );
      } else {
        generatedContent = await openaiService.generateMarketingContent(
          brandScript.generatedScript,
          contentType
        );
      }
    } catch (error) {
      console.error('Error generando contenido de marketing:', error);
      res.status(HttpStatusCode.InternalServerError).send({
        success: false,
        message: 'Error al generar el contenido de marketing'
      });
      return;
    }

    // Actualizar el BrandScript con el nuevo contenido
    const updateField = `marketingAssets.${contentType === 'landing' ? 'landingPage' : contentType === 'social' ? 'socialPosts' : contentType === 'elevator' ? 'elevatorPitch' : 'email'}`;
    
    await models.brandscript.findByIdAndUpdate(
      id,
      { $set: { [updateField]: generatedContent } },
      { new: true }
    );

    res.status(HttpStatusCode.Ok).send({
      success: true,
      message: 'Contenido de marketing generado exitosamente',
      data: {
        contentType,
        content: generatedContent
      }
    });

  } catch (error) {
    console.error('Error en generateMarketingContentController:', error);
    next(error);
  }
}

/**
 * Analizar y mejorar un BrandScript existente
 */
export async function analyzeBrandScriptController(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { aiProvider } = req.body;
    const userId = req.user?.id;

    // Obtener el BrandScript
    const brandScript = await models.brandscript.findById(id)
      .populate({
        path: 'business',
        select: 'name owner',
        match: { owner: userId }
      });

    if (!brandScript || !brandScript.business) {
      res.status(HttpStatusCode.NotFound).send({
        success: false,
        message: 'BrandScript no encontrado o no tienes permisos para acceder a él'
      });
      return;
    }

    // Generar análisis con IA (solo disponible con Gemini por ahora)
    let analysis: string;
    try {
      const provider = aiProvider || 'gemini';
      if (provider === 'gemini') {
        analysis = await geminiService.analyzeBrandScript(brandScript.generatedScript);
      } else {
        // Para OpenAI, podríamos implementar una función similar
        res.status(HttpStatusCode.BadRequest).send({
          success: false,
          message: 'El análisis de BrandScript solo está disponible con Gemini por ahora'
        });
        return;
      }
    } catch (error) {
      console.error('Error analizando BrandScript:', error);
      res.status(HttpStatusCode.InternalServerError).send({
        success: false,
        message: 'Error al analizar el BrandScript'
      });
      return;
    }

    // Guardar el análisis
    await models.brandscript.findByIdAndUpdate(
      id,
      { $set: { analysis } },
      { new: true }
    );

    res.status(HttpStatusCode.Ok).send({
      success: true,
      message: 'Análisis de BrandScript completado exitosamente',
      data: {
        analysis
      }
    });

  } catch (error) {
    console.error('Error en analyzeBrandScriptController:', error);
    next(error);
  }
}

/**
 * Actualizar el estado de un BrandScript
 */
export async function updateBrandScriptStatusController(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user?.id;

    // Validar estado
    const validStatuses = ['draft', 'completed', 'archived'];
    if (!validStatuses.includes(status)) {
      res.status(HttpStatusCode.BadRequest).send({
        success: false,
        message: 'Estado inválido. Debe ser: draft, completed, o archived'
      });
      return;
    }

    // Verificar permisos y actualizar
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
      res.status(HttpStatusCode.NotFound).send({
        success: false,
        message: 'BrandScript no encontrado o no tienes permisos para modificarlo'
      });
      return;
    }

    res.status(HttpStatusCode.Ok).send({
      success: true,
      message: 'Estado del BrandScript actualizado exitosamente',
      data: brandScript
    });

  } catch (error) {
    console.error('Error en updateBrandScriptStatusController:', error);
    next(error);
  }
}

/**
 * Eliminar un BrandScript
 */
export async function deleteBrandScriptController(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    // Verificar permisos y eliminar
    const brandScript = await models.brandscript.findOneAndDelete({
      _id: id,
      business: {
        $in: await models.business.find({ owner: userId }).distinct('_id')
      }
    });

    if (!brandScript) {
      res.status(HttpStatusCode.NotFound).send({
        success: false,
        message: 'BrandScript no encontrado o no tienes permisos para eliminarlo'
      });
      return;
    }

    res.status(HttpStatusCode.Ok).send({
      success: true,
      message: 'BrandScript eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error en deleteBrandScriptController:', error);
    next(error);
  }
}