import type { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import models from '../models';
import { HttpStatusCode } from 'axios';
import type { IUserProfile, IBusinessContext, IOnboardingPreferences } from '../models/onboarding.model';
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string; 
  };
}
interface CreateOnboardingRequest extends Request {
  body: {
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

/**
 * Create or update user onboarding information
 */
export async function createOnboarding(req: CreateOnboardingRequest & AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userProfile, businessContext, preferences } = req.body;
    const userId = req.user?.id;
    if (!userId) {
      res.status(HttpStatusCode.Unauthorized).send({
        message: "User authentication required."
      });
      return;
    }

    if (!userProfile || !businessContext) {
      res.status(HttpStatusCode.BadRequest).send({
        message: "User profile and business context are required."
      });
      return;
    }
    const user = await models.user.findById(userId);
    if (!user) {
      res.status(HttpStatusCode.NotFound).send({
        message: "User not found."
      });
      return;
    }
    const existingOnboarding = await models.onboarding.findOne({ user: userId });
    if (existingOnboarding) {
      res.status(HttpStatusCode.Conflict).send({
        message: "Onboarding already exists for this user."
      });
      return;
    }
    const onboardingData = {
      user: userId,
      userProfile,
      businessContext,
      preferences: preferences || {
        communicationFrequency: 'weekly',
        preferredContentTypes: [],
        aiProviderPreference: 'no_preference',
        notificationSettings: {
          email: true,
          inApp: true,
          contentGenerated: true,
          weeklyReports: true,
          systemUpdates: false
        },
        onboardingCompleted: false,
        completedSteps: ['user_profile', 'business_context']
      }
    };

    const onboarding = new models.onboarding(onboardingData);
    await onboarding.save();
    user.onboarding = onboarding._id as Types.ObjectId;
    await user.save();

    res.status(HttpStatusCode.Created).send({
      message: "Onboarding created successfully.",
      onboarding,
      nextStep: onboarding.getNextStep(),
      isComplete: onboarding.isComplete()
    });
    return;

  } catch (error) {
    console.error('Error creating onboarding:', error);
    next(error);
  }
}

/**
 * Get user onboarding information
 */
export async function getOnboarding(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(HttpStatusCode.Unauthorized).send({
        message: "User authentication required."
      });
      return;
    }
    const onboarding = await models.onboarding.findOne({ user: userId });
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
 * Update user onboarding information
 */
export async function updateOnboarding(req: UpdateOnboardingRequest & AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userProfile, businessContext, preferences, completedStep } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(HttpStatusCode.Unauthorized).send({
        message: "User authentication required."
      });
      return;
    }
    const onboarding = await models.onboarding.findOne({ user: userId });
    if (!onboarding) {
      res.status(HttpStatusCode.NotFound).send({
        message: "Onboarding not found. Please create onboarding first."
      });
      return;
    }
    if (userProfile) {
      onboarding.userProfile = { ...onboarding.userProfile, ...userProfile };
    }

    if (businessContext) {
      onboarding.businessContext = { ...onboarding.businessContext, ...businessContext };
    }

    if (preferences) {
      onboarding.preferences = { ...onboarding.preferences, ...preferences };
    }
    if (completedStep) {
      const completedSteps = onboarding.preferences?.completedSteps || [];
      if (!completedSteps.includes(completedStep)) {
        completedSteps.push(completedStep);
        if (onboarding.preferences) {
          onboarding.preferences.completedSteps = completedSteps;
        }
      }
    }

    await onboarding.save();

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
 * Mark onboarding step as completed
 */
export async function completeOnboardingStep(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { step } = req.body as { step: 'user_profile' | 'business_context' | 'preferences' | 'first_content' };
    const userId = req.user?.id;

    if (!userId) {
      res.status(HttpStatusCode.Unauthorized).send({
        message: "User authentication required."
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
    const onboarding = await models.onboarding.findOne({ user: userId });
    if (!onboarding) {
      res.status(HttpStatusCode.NotFound).send({
        message: "Onboarding not found. Please create onboarding first."
      });
      return;
    }

    const completedSteps = onboarding.preferences?.completedSteps || [];
    if (!completedSteps.includes(step)) {
      completedSteps.push(step);
      if (onboarding.preferences) {
        onboarding.preferences.completedSteps = completedSteps;
      }
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
 * Delete user onboarding (reset process)
 */
export async function deleteOnboarding(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(HttpStatusCode.Unauthorized).send({
        message: "User authentication required."
      });
      return;
    }
    const onboarding = await models.onboarding.findOneAndDelete({ user: userId });
    if (!onboarding) {
      res.status(HttpStatusCode.NotFound).send({
        message: "Onboarding not found."
      });
      return;
    }
    await models.user.findByIdAndUpdate(userId, { $unset: { onboarding: 1 } });

    res.status(HttpStatusCode.Ok).send({
      message: "Onboarding deleted successfully."
    });
    return;

  } catch (error) {
    console.error('Error deleting onboarding:', error);
    next(error);
  }
}

/**
 * Initialize onboarding for a user
 */
export async function initializeOnboarding(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(HttpStatusCode.Unauthorized).send({
        message: "User authentication required."
      });
      return;
    }
    const user = await models.user.findById(userId);
    if (!user) {
      res.status(HttpStatusCode.NotFound).send({
        message: "User not found."
      });
      return;
    }
    const existingOnboarding = await models.onboarding.findOne({ user: userId });
    if (existingOnboarding) {
      res.status(HttpStatusCode.Conflict).send({
        message: "Onboarding already exists for this user.",
        onboarding: existingOnboarding,
        nextStep: existingOnboarding.getNextStep(),
        isComplete: existingOnboarding.isComplete()
      });
      return;
    }
    const onboarding = new models.onboarding({
      user: userId,
      completionPercentage: 0,
      startedAt: new Date()
    });

    await onboarding.save();
    await models.user.findByIdAndUpdate(userId, { onboarding: onboarding._id });

    res.status(HttpStatusCode.Created).send({
      message: "Onboarding initialized successfully.",
      onboarding,
      nextStep: onboarding.getNextStep(),
      isComplete: onboarding.isComplete()
    });
    return;

  } catch (error) {
    console.error('Error initializing onboarding:', error);
    next(error);
  }
}