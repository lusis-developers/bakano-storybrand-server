import { Router } from 'express';
import {
  createBrandScriptController,
  getBrandScriptsController,
  getBrandScriptByIdController,
  generateMarketingContentController,
  analyzeBrandScriptController,
  updateBrandScriptStatusController,
  deleteBrandScriptController,
  getBrandScriptCampaignReadiness
} from '../controllers/brandscript.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

/**
 * @route POST /api/brandscripts
 * @desc Crear un nuevo BrandScript
 * @access Private
 * @body {
 *   businessId: string,
 *   answers: {
 *     companyName: string,
 *     productsServices: string,
 *     targetAudience: string,
 *     mainProblem: string,
 *     solution: string,
 *     uniqueCharacteristics: string,
 *     authority: string,
 *     steps: string
 *   },
 *   aiProvider?: 'openai' | 'gemini'
 * }
 */
router.post('/', createBrandScriptController);

/**
 * @route GET /api/brandscripts
 * @desc Obtener todos los BrandScripts del usuario
 * @access Private
 * @query {
 *   page?: number,
 *   limit?: number,
 *   businessId?: string,
 *   status?: 'draft' | 'completed' | 'archived'
 * }
 */
router.get('/', getBrandScriptsController);

/**
 * @route GET /api/brandscripts/:id
 * @desc Obtener un BrandScript específico
 * @access Private
 */
router.get('/:id', getBrandScriptByIdController);

/**
 * @route POST /api/brandscripts/:id/marketing
 * @desc Generar contenido de marketing basado en el BrandScript
 * @access Private
 * @body {
 *   contentType: 'email' | 'landing' | 'social' | 'elevator',
 *   aiProvider?: 'openai' | 'gemini'
 * }
 */
router.post('/:id/marketing', generateMarketingContentController);

/**
 * @route POST /api/brandscripts/:id/analyze
 * @desc Analizar y mejorar un BrandScript existente
 * @access Private
 * @body {
 *   aiProvider?: 'gemini'
 * }
 */
router.post('/:id/analyze', analyzeBrandScriptController);

/**
 * @route PATCH /api/brandscripts/:id/status
 * @desc Actualizar el estado de un BrandScript
 * @access Private
 * @body {
 *   status: 'draft' | 'completed' | 'archived'
 * }
 */
router.patch('/:id/status', updateBrandScriptStatusController);

/**
 * @route DELETE /api/brandscripts/:id
 * @desc Eliminar un BrandScript
 * @access Private
 */
router.delete('/:id', deleteBrandScriptController);

/**
 * @route GET /api/brandscripts/:id/campaign-readiness
 * @desc Check if BrandScript is ready for campaign creation
 * @access Private
 */
router.get('/:id/campaign-readiness', getBrandScriptCampaignReadiness);

export default router;