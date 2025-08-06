import { Router } from 'express';
import {
  createOnboarding,
  getOnboarding,
  updateOnboarding,
  completeOnboardingStep,
  deleteOnboarding,
  initializeOnboarding
} from '../controllers/onboarding.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * @route POST /api/onboarding/initialize
 * @desc Initialize onboarding for a user
 * @access Private
 */
router.post('/initialize', initializeOnboarding);

/**
 * @route POST /api/onboarding
 * @desc Create or update user onboarding process
 * @access Private
 * @body {
 *   userProfile: IUserProfile,
 *   businessContext: IBusinessContext,
 *   preferences?: Partial<IOnboardingPreferences>
 * }
 */
router.post('/', createOnboarding);

/**
 * @route GET /api/onboarding
 * @desc Get user onboarding information
 * @access Private
 */
router.get('/', getOnboarding);

/**
 * @route PUT /api/onboarding
 * @desc Update user onboarding information
 * @access Private
 * @body {
 *   userProfile?: Partial<IUserProfile>,
 *   businessContext?: Partial<IBusinessContext>,
 *   preferences?: Partial<IOnboardingPreferences>,
 *   completedStep?: 'user_profile' | 'business_context' | 'preferences' | 'first_content'
 * }
 */
router.put('/', updateOnboarding);

/**
 * @route POST /api/onboarding/complete-step
 * @desc Mark an onboarding step as completed
 * @access Private
 * @body { step: string }
 */
router.post('/complete-step', completeOnboardingStep);

/**
 * @route DELETE /api/onboarding
 * @desc Delete user onboarding (reset process)
 * @access Private
 */
router.delete('/', deleteOnboarding);

export default router;