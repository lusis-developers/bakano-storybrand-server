import { Request, Response } from 'express';
import { AuthRequest } from '../types/AuthRequest';
import models from '../models';
import { HttpStatusCode } from 'axios';
import {
  UserRole,
  BusinessType,
  ContentCreatorType,
  StoryBrandGoal,
  StoryBrandFamiliarity,
  MarketingChannel,
  UserRoleLabels,
  BusinessTypeLabels,
  ContentCreatorTypeLabels,
  StoryBrandGoalLabels,
  StoryBrandFamiliarityLabels,
  MarketingChannelLabels
} from '../enums/onboarding.enum';
/**
 * Obtener las opciones disponibles para el onboarding
 */
export async function getOnboardingOptions(req: Request, res: Response) {
  try {
    const options = {
      userRoles: Object.entries(UserRoleLabels).map(([value, label]) => ({ value, label })),
      businessTypes: Object.entries(BusinessTypeLabels).map(([value, label]) => ({ value, label })),
      contentCreatorTypes: Object.entries(ContentCreatorTypeLabels).map(([value, label]) => ({ value, label })),
      storyBrandGoals: Object.entries(StoryBrandGoalLabels).map(([value, label]) => ({ value, label })),
      storyBrandFamiliarity: Object.entries(StoryBrandFamiliarityLabels).map(([value, label]) => ({ value, label })),
      marketingChannels: Object.entries(MarketingChannelLabels).map(([value, label]) => ({ value, label }))
    };

    res.status(HttpStatusCode.Ok).send({
      success: true,
      data: options
    });
  } catch (error) {
    console.error('Error getting onboarding options:', error);
    res.status(HttpStatusCode.InternalServerError).send({
      success: false,
      message: 'Internal server error'
    });
  }
}

/**
 * Crear o actualizar el contexto de onboarding para un business
 */
export async function createOrUpdateOnboardingContext(req: AuthRequest, res: Response) {
  try {
    const { businessId } = req.params;
    const {
      userRole,
      businessTypes,
      contentCreatorType,
      storyBrandGoals,
      otherGoal,
      storyBrandFamiliarity,
      currentMarketingChannels
    } = req.body;

    // Verificar que el business existe y pertenece al usuario
    const business = await models.business.findOne({
      _id: businessId,
      owner: req.user?.id
    });

    if (!business) {
      return res.status(HttpStatusCode.NotFound).send({
        success: false,
        message: 'Business not found'
      });
    }

    // Validaciones básicas
    if (!userRole || !contentCreatorType || !storyBrandFamiliarity) {
      return res.status(HttpStatusCode.BadRequest).send({
        success: false,
        message: 'Required fields: userRole, contentCreatorType, storyBrandFamiliarity'
      });
    }

    if (!storyBrandGoals || !Array.isArray(storyBrandGoals) || storyBrandGoals.length === 0) {
      return res.status(HttpStatusCode.BadRequest).send({
        success: false,
        message: 'Must select at least one StoryBrand goal'
      });
    }

    if (!currentMarketingChannels || !Array.isArray(currentMarketingChannels) || currentMarketingChannels.length === 0) {
      return res.status(HttpStatusCode.BadRequest).send({
        success: false,
        message: 'Must select at least one marketing channel'
      });
    }

    // Validar enums
    if (!Object.values(UserRole).includes(userRole)) {
      return res.status(HttpStatusCode.BadRequest).send({
        success: false,
        message: 'Invalid user role'
      });
    }

    if (!Object.values(ContentCreatorType).includes(contentCreatorType)) {
      return res.status(HttpStatusCode.BadRequest).send({
        success: false,
        message: 'Invalid content creator type'
      });
    }

    if (!Object.values(StoryBrandFamiliarity).includes(storyBrandFamiliarity)) {
      return res.status(HttpStatusCode.BadRequest).send({
        success: false,
        message: 'Invalid StoryBrand familiarity level'
      });
    }

    // Validar arrays de enums
    const invalidGoals = storyBrandGoals.filter(goal => !Object.values(StoryBrandGoal).includes(goal));
    if (invalidGoals.length > 0) {
      return res.status(HttpStatusCode.BadRequest).send({
        success: false,
        message: `Invalid goals: ${invalidGoals.join(', ')}`
      });
    }

    const invalidChannels = currentMarketingChannels.filter(channel => !Object.values(MarketingChannel).includes(channel));
    if (invalidChannels.length > 0) {
      return res.status(HttpStatusCode.BadRequest).send({
        success: false,
        message: `Invalid marketing channels: ${invalidChannels.join(', ')}`
      });
    }

    // Validar businessTypes si el rol es business owner
    if (userRole === UserRole.BUSINESS_OWNER) {
      if (!businessTypes || !Array.isArray(businessTypes) || businessTypes.length === 0) {
        return res.status(HttpStatusCode.BadRequest).send({
          success: false,
          message: 'Must select at least one business type for Business Owner'
        });
      }

      const invalidBusinessTypes = businessTypes.filter(type => !Object.values(BusinessType).includes(type));
      if (invalidBusinessTypes.length > 0) {
        return res.status(HttpStatusCode.BadRequest).send({
          success: false,
          message: `Invalid business types: ${invalidBusinessTypes.join(', ')}`
        });
      }
    }

    // Crear o actualizar el contexto
    const contextData = {
      business: businessId,
      userRole,
      businessTypes: userRole === UserRole.BUSINESS_OWNER ? businessTypes : undefined,
      contentCreatorType,
      storyBrandGoals,
      otherGoal: storyBrandGoals.includes(StoryBrandGoal.OTHER) ? otherGoal : undefined,
      storyBrandFamiliarity,
      currentMarketingChannels
    };

    const onboardingContext = await models.onboardingContext.findOneAndUpdate(
      { business: businessId },
      contextData,
      { 
        new: true, 
        upsert: true,
        runValidators: true
      }
    );

    res.status(HttpStatusCode.Ok).send({
      success: true,
      message: 'Onboarding context saved successfully',
      data: onboardingContext
    });

  } catch (error) {
    console.error('Error creating/updating onboarding context:', error);
    if (error instanceof Error) {
      res.status(HttpStatusCode.InternalServerError).send({
        success: false,
        message: error.message
      });
    } else {
      res.status(HttpStatusCode.InternalServerError).send({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

/**
 * Obtener el contexto de onboarding de un business
 */
export async function getOnboardingContext(req: AuthRequest, res: Response) {
  try {
    const { businessId } = req.params;

    // Verificar que el business existe y pertenece al usuario
    const business = await models.business.findOne({
      _id: businessId,
      owner: req.user?.id
    });

    if (!business) {
      return res.status(HttpStatusCode.NotFound).send({
        success: false,
        message: 'Business not found'
      });
    }

    const onboardingContext = await models.onboardingContext.findOne({
      business: businessId
    });

    if (!onboardingContext) {
      return res.status(HttpStatusCode.NotFound).send({
        success: false,
        message: 'Onboarding context not found'
      });
    }

    res.status(HttpStatusCode.Ok).send({
      success: true,
      data: onboardingContext
    });

  } catch (error) {
    console.error('Error getting onboarding context:', error);
    if (error instanceof Error) {
      res.status(HttpStatusCode.InternalServerError).send({
        success: false,
        message: error.message
      });
    } else {
      res.status(HttpStatusCode.InternalServerError).send({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

/**
 * Verificar si un business tiene contexto de onboarding completo
 */
export async function checkOnboardingStatus(req: AuthRequest, res: Response) {
  try {
    const { businessId } = req.params;

    // Verificar que el business existe y pertenece al usuario
    const business = await models.business.findOne({
      _id: businessId,
      owner: req.user?.id
    });

    if (!business) {
      return res.status(HttpStatusCode.NotFound).send({
        success: false,
        message: 'Business not found'
      });
    }

    const onboardingContext = await models.onboardingContext.findOne({
      business: businessId
    });

    const status = {
      hasContext: !!onboardingContext,
      isComplete: onboardingContext?.isComplete || false,
      completedAt: onboardingContext?.completedAt || null,
      contextSummary: onboardingContext?.contextSummary || null
    };

    res.status(HttpStatusCode.Ok).send({
      success: true,
      data: status
    });

  } catch (error) {
    console.error('Error checking onboarding status:', error);
    if (error instanceof Error) {
      res.status(HttpStatusCode.InternalServerError).send({
        success: false,
        message: error.message
      });
    } else {
      res.status(HttpStatusCode.InternalServerError).send({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

/**
 * Eliminar el contexto de onboarding de un business
 */
export async function deleteOnboardingContext(req: AuthRequest, res: Response) {
  try {
    const { businessId } = req.params;

    // Verificar que el business existe y pertenece al usuario
    const business = await models.business.findOne({
      _id: businessId,
      owner: req.user?.id
    });

    if (!business) {
      return res.status(HttpStatusCode.NotFound).send({
        success: false,
        message: 'Business not found'
      });
    }

    const deletedContext = await models.onboardingContext.findOneAndDelete({
      business: businessId
    });

    if (!deletedContext) {
      return res.status(HttpStatusCode.NotFound).send({
        success: false,
        message: 'Onboarding context not found'
      });
    }

    res.status(HttpStatusCode.Ok).send({
      success: true,
      message: 'Onboarding context deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting onboarding context:', error);
    if (error instanceof Error) {
      res.status(HttpStatusCode.InternalServerError).send({
        success: false,
        message: error.message
      });
    } else {
      res.status(HttpStatusCode.InternalServerError).send({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}
