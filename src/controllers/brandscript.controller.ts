import type { Response, NextFunction } from 'express';
import { HttpStatusCode } from 'axios';
import { Types } from 'mongoose';
import type { AuthRequest } from '../types/AuthRequest';
import brandScriptService from '../services/brandscript.service';
import models from '../models';



/**
 * Crear un nuevo BrandScript
 */
export async function createBrandScriptController(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { businessId, answers, aiProvider = 'gemini' } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(HttpStatusCode.Unauthorized).send({
        success: false,
        message: 'Usuario no autenticado'
      });
      return;
    }

    const brandScript = await brandScriptService.createBrandScript({
      businessId,
      answers,
      aiProvider,
      userId
    });

    res.status(HttpStatusCode.Created).send({
      success: true,
      message: 'BrandScript creado exitosamente',
      data: brandScript
    });

  } catch (error) {
    console.error('Error en createBrandScriptController:', error);
    
    if (error instanceof Error && (error.message.includes('no encontrado') || error.message.includes('permisos'))) {
      res.status(HttpStatusCode.NotFound).send({
        success: false,
        message: error.message
      });
      return;
    }
    
    if (error instanceof Error && error.message.includes('requerido')) {
      res.status(HttpStatusCode.BadRequest).send({
        success: false,
        message: error.message
      });
      return;
    }
    
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

    if (!userId) {
      res.status(HttpStatusCode.Unauthorized).send({
        success: false,
        message: 'Usuario no autenticado'
      });
      return;
    }

    const result = await brandScriptService.getBrandScriptsByUser(userId, {
      page: Number(page),
      limit: Number(limit),
      businessId: businessId as string,
      status: status as string
    });

    res.status(HttpStatusCode.Ok).send({
      success: true,
      message: 'BrandScripts obtenidos exitosamente',
      data: {
        brandScripts: result.data,
        pagination: result.pagination
      }
    });

  } catch (error) {
    console.error('Error en deleteBrandScriptController:', error);
    next(error);
  }
}

/**
 * Get BrandScript completion status and campaign readiness
 */
export async function getBrandScriptCampaignReadiness(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { brandScriptId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(HttpStatusCode.Unauthorized).send({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    if (!Types.ObjectId.isValid(brandScriptId)) {
      res.status(HttpStatusCode.BadRequest).send({
        success: false,
        message: 'Invalid BrandScript ID'
      });
      return;
    }

    // Get BrandScript with business ownership validation
    const brandScript = await models.brandscript.findById(brandScriptId)
      .populate({
        path: 'business',
        select: 'name industry owner',
        match: { owner: userId }
      });

    if (!brandScript || !brandScript.business) {
      res.status(HttpStatusCode.NotFound).send({
        success: false,
        message: 'BrandScript not found or you do not have permission to access it'
      });
      return;
    }

    // Check if BrandScript is completed
    const isCompleted = brandScript.status === 'completed';
    const hasRequiredFields = !!
      brandScript.controllingIdea &&
      brandScript.characterWhatTheyWant &&
      brandScript.problemExternal &&
      brandScript.guideEmpathy &&
      brandScript.planProcessSteps?.length > 0 &&
      brandScript.callToActionDirect &&
      brandScript.successResults;

    const canCreateCampaign = isCompleted && hasRequiredFields;

    // Get existing campaigns for this BrandScript
    // TODO: Implement campaign model
    const existingCampaigns: any[] = []; // await models.campaign.find({
    //   brandScript: brandScriptId
    // }).select('title status createdAt').sort({ createdAt: -1 });

    res.status(HttpStatusCode.Ok).send({
      success: true,
      message: 'BrandScript campaign readiness retrieved successfully.',
      data: {
        brandScript: {
          id: brandScript._id,
          controllingIdea: brandScript.controllingIdea,
          status: brandScript.status,
          isCompleted,
          hasRequiredFields,
          canCreateCampaign
        },
        business: {
          id: brandScript.business._id,
          name: (brandScript.business as any).name,
          industry: (brandScript.business as any).industry
        },
        existingCampaigns,
        nextSteps: canCreateCampaign 
          ? 'You can now create a campaign to generate marketing assets based on this BrandScript.'
          : 'Complete the BrandScript first to unlock campaign creation.'
      }
    });
    return;

  } catch (error) {
    console.error('Error getting BrandScript campaign readiness:', error);
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

    if (!userId) {
      res.status(HttpStatusCode.Unauthorized).send({
        success: false,
        message: 'Usuario no autenticado'
      });
      return;
    }

    const brandScript = await brandScriptService.getBrandScriptById(id, userId);

    res.status(HttpStatusCode.Ok).send({
      success: true,
      message: 'BrandScript obtenido exitosamente',
      data: brandScript
    });

  } catch (error) {
    console.error('Error en getBrandScriptByIdController:', error);
    
    if (error instanceof Error && (error.message.includes('no encontrado') || error.message.includes('permisos'))) {
      res.status(HttpStatusCode.NotFound).send({
        success: false,
        message: error.message
      });
      return;
    }
    
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

    if (!userId) {
      res.status(HttpStatusCode.Unauthorized).send({
        success: false,
        message: 'Usuario no autenticado'
      });
      return;
    }

    // Validar tipo de contenido usando el servicio
    if (!brandScriptService.validateContentType(contentType)) {
      res.status(HttpStatusCode.BadRequest).send({
        success: false,
        message: 'Tipo de contenido inválido. Debe ser: email, landing, social, o elevator'
      });
      return;
    }

    // Obtener el BrandScript usando el servicio
    const brandScript = await brandScriptService.getBrandScriptById(id, userId);

    // Generar contenido usando el servicio
    const generatedContent = await brandScriptService.generateMarketingContent(
      brandScript,
      contentType,
      aiProvider
    );

    // Actualizar el BrandScript con el nuevo contenido usando el servicio
    await brandScriptService.updateMarketingContent(id, contentType, generatedContent);

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
    
    if (error instanceof Error && (error.message.includes('no encontrado') || error.message.includes('permisos'))) {
      res.status(HttpStatusCode.NotFound).send({
        success: false,
        message: error.message
      });
      return;
    }
    
    if (error instanceof Error && (error.message.includes('requerido') || error.message.includes('inválido'))) {
      res.status(HttpStatusCode.BadRequest).send({
        success: false,
        message: error.message
      });
      return;
    }
    
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

    if (!userId) {
      res.status(HttpStatusCode.Unauthorized).send({
        success: false,
        message: 'Usuario no autenticado'
      });
      return;
    }

    // Obtener el BrandScript usando el servicio
    const brandScript = await brandScriptService.getBrandScriptById(id, userId);

    // Analizar con IA usando el servicio
    const analysis = await brandScriptService.analyzeBrandScript(brandScript, aiProvider);

    // Guardar el análisis usando el servicio
    await brandScriptService.saveAnalysis(id, analysis);

    res.status(HttpStatusCode.Ok).send({
      success: true,
      message: 'Análisis de BrandScript completado exitosamente',
      data: {
        analysis
      }
    });

  } catch (error) {
    console.error('Error en analyzeBrandScriptController:', error);
    
    if (error instanceof Error && (error.message.includes('no encontrado') || error.message.includes('permisos'))) {
      res.status(HttpStatusCode.NotFound).send({
        success: false,
        message: error.message
      });
      return;
    }
    
    if (error instanceof Error && error.message.includes('solo está disponible')) {
      res.status(HttpStatusCode.BadRequest).send({
        success: false,
        message: error.message
      });
      return;
    }
    
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

    if (!userId) {
      res.status(HttpStatusCode.Unauthorized).send({
        success: false,
        message: 'Usuario no autenticado'
      });
      return;
    }

    // Validar estado usando el servicio
    if (!brandScriptService.validateStatus(status)) {
      res.status(HttpStatusCode.BadRequest).send({
        success: false,
        message: 'Estado inválido. Debe ser: draft, completed, o archived'
      });
      return;
    }

    // Actualizar el estado usando el servicio
    const brandScript = await brandScriptService.updateStatus(id, status, userId);

    res.status(HttpStatusCode.Ok).send({
      success: true,
      message: 'Estado del BrandScript actualizado exitosamente',
      data: brandScript
    });

  } catch (error) {
    console.error('Error en updateBrandScriptStatusController:', error);
    
    if (error instanceof Error && (error.message.includes('no encontrado') || error.message.includes('permisos'))) {
      res.status(HttpStatusCode.NotFound).send({
        success: false,
        message: error.message
      });
      return;
    }
    
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

    if (!userId) {
      res.status(HttpStatusCode.Unauthorized).send({
        success: false,
        message: 'Usuario no autenticado'
      });
      return;
    }

    // Eliminar el BrandScript usando el servicio
    await brandScriptService.deleteBrandScript(id, userId);

    res.status(HttpStatusCode.Ok).send({
      success: true,
      message: 'BrandScript eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error en deleteBrandScriptController:', error);
    
    if (error instanceof Error && (error.message.includes('no encontrado') || error.message.includes('permisos'))) {
      res.status(HttpStatusCode.NotFound).send({
        success: false,
        message: error.message
      });
      return;
    }
    
    next(error);
  }
}