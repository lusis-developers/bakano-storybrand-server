import { Router } from 'express';
import {
  createContentProject,
  getContentByBusiness,
  updateQuestions,
  generateSoundbitesAndTaglines,
  generateScripts,
  getUserContentProjects,
  deleteContentProject
} from '../controllers/content.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * @route POST /api/content/business/:businessId
 * @desc Create new content project for a business
 * @access Private
 * @body {
 *   questions: IBusinessQuestions,
 *   tone?: string,
 *   aiProvider?: 'openai' | 'gemini'
 * }
 */
router.post('/business/:businessId', createContentProject);

/**
 * @route GET /api/content/business/:businessId
 * @desc Get content project by business ID
 * @access Private
 */
router.get('/business/:businessId', getContentByBusiness);

/**
 * @route GET /api/content/projects
 * @desc Get all content projects for authenticated user
 * @access Private
 * @query {
 *   page?: number,
 *   limit?: number,
 *   status?: string
 * }
 */
router.get('/projects', getUserContentProjects);

/**
 * @route PUT /api/content/:contentId/questions
 * @desc Update business questions
 * @access Private
 * @body {
 *   questions: Partial<IBusinessQuestions>
 * }
 */
router.put('/:contentId/questions', updateQuestions);

/**
 * @route POST /api/content/:contentId/generate-soundbites-taglines
 * @desc Generate soundbites and taglines based on business questions
 * @access Private
 * @body {
 *   regenerate?: boolean
 * }
 */
router.post('/:contentId/generate-soundbites-taglines', generateSoundbitesAndTaglines);

/**
 * @route POST /api/content/:contentId/generate-script
 * @desc Generate scripts for content or ads
 * @access Private
 * @body {
 *   scriptType: 'content' | 'ad',
 *   platform?: string,
 *   selectedSoundbite?: string,
 *   selectedTagline?: string
 * }
 */
router.post('/:contentId/generate-script', generateScripts);

/**
 * @route DELETE /api/content/:contentId
 * @desc Delete content project
 * @access Private
 */
router.delete('/:contentId', deleteContentProject);

export default router;