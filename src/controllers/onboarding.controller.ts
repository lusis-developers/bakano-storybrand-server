import type { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import models from '../models';
import { HttpStatusCode } from 'axios';
import type { IUserProfile, IBusinessContext, IOnboardingPreferences } from '../models/onboarding.model';

// Extend Request interface to include user
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string; 
  };
}

// Extended Request interfaces for type safety
interface CreateOnboardingRequest extends Request {
  body: {
    businessId: string;
    userProfile: IUserProfile;
    businessContext: IBusinessContext;
    preferences?: Partial<IOnboardingPreferences>;
  };
}

interface UpdateOnboardingRequest extends Request {
  body: {
    userProfile?: Partial<IUserProfile>;
    businessContext?: Partial<IBusinessContext>;
    preferences?: Partial<IOnboardingPreferences>;
    completedStep?: 'user_profile' | 'business_context' | 'preferences' | 'first_content';
  };
}

interface GetOnboardingRequest extends Request {
  params: {
    businessId: string;
  };
}

/**
 * Create a new onboarding process for a user and business
 */
export async function createOnboarding(req: CreateOnboardingRequest & AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { businessId, userProfile, businessContext, preferences } = req.body;
    const userId = req.user?.id;

    // Validate required fields
    if (!userId) {
      res.status(HttpStatusCode.Unauthorized).send({
        message: "User authentication required."
      });
      return;
    }

    if (!businessId || !Types.ObjectId.isValid(businessId)) {
      res.status(HttpStatusCode.BadRequest).send({
        message: "Valid business ID is required."
      });
      return;
    }

    if (!userProfile || !businessContext) {
      res.status(HttpStatusCode.BadRequest).send({
        message: "User profile and business context are required."
      });
      return;
    }

    // Verify business exists and user has access
    const business = await models.business.findOne({
      _id: businessId,
      $or: [
        { owner: userId },
        { employees: userId }
      ]
    });

    if (!business) {
      res.status(HttpStatusCode.NotFound).send({
        message: "Business not found or access denied."
      });
      return;
    }

    // Check if onboarding already exists
    const existingOnboarding = await models.onboarding.findOne({
      user: userId,
      business: businessId
    });

    if (existingOnboarding) {
      res.status(HttpStatusCode.Conflict).send({
        message: "Onboarding already exists for this user and business.",
        onboarding: existingOnboarding
      });
      return;
    }

    // Create new onboarding
    const onboarding = new models.onboarding({
      user: userId,
      business: businessId,
      userProfile,
      businessContext,
      preferences: {
        ...preferences,
        completedSteps: ['user_profile', 'business_context']
      }
    });

    await onboarding.save();

    // Populate references
    await onboarding.populate([
      { path: 'user', select: 'firstName lastName email' },
      { path: 'business', select: 'name industry' }
    ]);

    res.status(HttpStatusCode.Created).send({
      message: "Onboarding created successfully.",
      onboarding
    });
    return;

  } catch (error) {
    console.error('Error creating onboarding:', error);
    next(error);
  }
}

/**
 * Get onboarding information for a specific business
 */
export async function getOnboarding(req: GetOnboardingRequest & AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { businessId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(HttpStatusCode.Unauthorized).send({
        message: "User authentication required."
      });
      return;
    }

    if (!Types.ObjectId.isValid(businessId)) {
      res.status(HttpStatusCode.BadRequest).send({
        message: "Valid business ID is required."
      });
      return;
    }

    // Find onboarding with populated references
    const onboarding = await models.onboarding.findOne({
      user: userId,
      business: businessId
    }).populate([
      { path: 'user', select: 'firstName lastName email' },
      { path: 'business', select: 'name industry website' }
    ]);

    if (!onboarding) {
      res.status(HttpStatusCode.NotFound).send({
        message: "Onboarding not found."
      });
      return;
    }

    res.status(HttpStatusCode.Ok).send({
      message: "Onboarding retrieved successfully.",
      onboarding,
      nextStep: onboarding.getNextStep(),
      isComplete: onboarding.isComplete()
    });
    return;

  } catch (error) {
    console.error('Error retrieving onboarding:', error);
    next(error);
  }
}

/**
 * Update onboarding information
 */
export async function updateOnboarding(req: UpdateOnboardingRequest & AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { businessId } = req.params as { businessId: string };
    const { userProfile, businessContext, preferences, completedStep } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(HttpStatusCode.Unauthorized).send({
        message: "User authentication required."
      });
      return;
    }

    if (!Types.ObjectId.isValid(businessId)) {
      res.status(HttpStatusCode.BadRequest).send({
        message: "Valid business ID is required."
      });
      return;
    }

    // Find existing onboarding
    const onboarding = await models.onboarding.findOne({
      user: userId,
      business: businessId
    });

    if (!onboarding) {
      res.status(HttpStatusCode.NotFound).send({
        message: "Onboarding not found."
      });
      return;
    }

    // Update fields if provided
    if (userProfile) {
      onboarding.userProfile = { ...onboarding.userProfile, ...userProfile };
    }

    if (businessContext) {
      onboarding.businessContext = { ...onboarding.businessContext, ...businessContext };
    }

    if (preferences) {
      onboarding.preferences = { ...onboarding.preferences, ...preferences };
    }

    // Add completed step if provided
    if (completedStep) {
      const completedSteps = onboarding.preferences.completedSteps || [];
      if (!completedSteps.includes(completedStep)) {
        completedSteps.push(completedStep);
        onboarding.preferences.completedSteps = completedSteps;
      }
    }

    await onboarding.save();

    // Populate references
    await onboarding.populate([
      { path: 'user', select: 'firstName lastName email' },
      { path: 'business', select: 'name industry' }
    ]);

    res.status(HttpStatusCode.Ok).send({
      message: "Onboarding updated successfully.",
      onboarding,
      nextStep: onboarding.getNextStep(),
      isComplete: onboarding.isComplete()
    });
    return;

  } catch (error) {
    console.error('Error updating onboarding:', error);
    next(error);
  }
}

/**
 * Get all onboardings for the authenticated user
 */
export async function getUserOnboardings(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(HttpStatusCode.Unauthorized).send({
        message: "User authentication required."
      });
      return;
    }

    const onboardings = await models.onboarding.find({
      user: userId
    }).populate([
      { path: 'business', select: 'name industry website isActive' }
    ]).sort({ lastUpdated: -1 });

    const onboardingsWithStatus = onboardings.map(onboarding => ({
      ...onboarding.toObject(),
      nextStep: onboarding.getNextStep(),
      isComplete: onboarding.isComplete()
    }));

    res.status(HttpStatusCode.Ok).send({
      message: "User onboardings retrieved successfully.",
      onboardings: onboardingsWithStatus,
      total: onboardings.length
    });
    return;

  } catch (error) {
    console.error('Error retrieving user onboardings:', error);
    next(error);
  }
}

/**
 * Mark onboarding step as completed
 */
export async function completeOnboardingStep(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { businessId } = req.params as { businessId: string };
    const { step } = req.body as { step: 'user_profile' | 'business_context' | 'preferences' | 'first_content' };
    const userId = req.user?.id;

    if (!userId) {
      res.status(HttpStatusCode.Unauthorized).send({
        message: "User authentication required."
      });
      return;
    }

    if (!Types.ObjectId.isValid(businessId)) {
      res.status(HttpStatusCode.BadRequest).send({
        message: "Valid business ID is required."
      });
      return;
    }

    if (!step) {
      res.status(HttpStatusCode.BadRequest).send({
        message: "Step is required."
      });
      return;
    }

    const validSteps = ['user_profile', 'business_context', 'preferences', 'first_content'];
    if (!validSteps.includes(step)) {
      res.status(HttpStatusCode.BadRequest).send({
        message: "Invalid step. Valid steps are: " + validSteps.join(', ')
      });
      return;
    }

    // Find and update onboarding
    const onboarding = await models.onboarding.findOne({
      user: userId,
      business: businessId
    });

    if (!onboarding) {
      res.status(HttpStatusCode.NotFound).send({
        message: "Onboarding not found."
      });
      return;
    }

    const completedSteps = onboarding.preferences.completedSteps || [];
    if (!completedSteps.includes(step)) {
      completedSteps.push(step);
      onboarding.preferences.completedSteps = completedSteps;
      await onboarding.save();
    }

    res.status(HttpStatusCode.Ok).send({
      message: `Step '${step}' completed successfully.`,
      completionPercentage: onboarding.completionPercentage,
      nextStep: onboarding.getNextStep(),
      isComplete: onboarding.isComplete()
    });
    return;

  } catch (error) {
    console.error('Error completing onboarding step:', error);
    next(error);
  }
}

/**
 * Delete onboarding (reset process)
 */
export async function deleteOnboarding(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { businessId } = req.params as { businessId: string };
    const userId = req.user?.id;

    if (!userId) {
      res.status(HttpStatusCode.Unauthorized).send({
        message: "User authentication required."
      });
      return;
    }

    if (!Types.ObjectId.isValid(businessId)) {
      res.status(HttpStatusCode.BadRequest).send({
        message: "Valid business ID is required."
      });
      return;
    }

    const result = await models.onboarding.deleteOne({
      user: userId,
      business: businessId
    });

    if (result.deletedCount === 0) {
      res.status(HttpStatusCode.NotFound).send({
        message: "Onboarding not found."
      });
      return;
    }

    res.status(HttpStatusCode.Ok).send({
      message: "Onboarding deleted successfully."
    });
    return;

  } catch (error) {
    console.error('Error deleting onboarding:', error);
    next(error);
  }
}