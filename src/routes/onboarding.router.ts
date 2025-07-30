  import { Router } from 'express';
import {
  createOnboarding,
  getOnboarding,
  updateOnboarding,
  getUserOnboardings,
  completeOnboardingStep,
  deleteOnboarding
} from '../controllers/onboarding.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * @route POST /api/onboarding
 * @desc Create a new onboarding process
 * @access Private
 * @body {
 *   businessId: string,
 *   userProfile: IUserProfile,
 *   businessContext: IBusinessContext,
 *   preferences?: Partial<IOnboardingPreferences>
 * }
 */
router.post('/', createOnboarding);

/**
 * @route GET /api/onboarding
 * @desc Get all onboardings for the authenticated user
 * @access Private
 */
router.get('/', getUserOnboardings);

/**
 * @route GET /api/onboarding/:businessId
 * @desc Get onboarding information for a specific business
 * @access Private
 * @params businessId: string
 */
router.get('/:businessId', getOnboarding);

/**
 * @route PUT /api/onboarding/:businessId
 * @desc Update onboarding information
 * @access Private
 * @params businessId: string
 * @body {
 *   userProfile?: Partial<IUserProfile>,
 *   businessContext?: Partial<IBusinessContext>,
 *   preferences?: Partial<IOnboardingPreferences>,
 *   completedStep?: 'user_profile' | 'business_context' | 'preferences' | 'first_content'
 * }
 */
router.put('/:businessId', updateOnboarding);

/**
 * @route POST /api/onboarding/:businessId/complete-step
 * @desc Mark a specific onboarding step as completed
 * @access Private
 * @params businessId: string
 * @body {
 *   step: 'user_profile' | 'business_context' | 'preferences' | 'first_content'
 * }
 */
router.post('/:businessId/complete-step', completeOnboardingStep);

/**
 * @route DELETE /api/onboarding/:businessId
 * @desc Delete onboarding (reset process)
 * @access Private
 * @params businessId: string
 */
router.delete('/:businessId', deleteOnboarding);

export default router;