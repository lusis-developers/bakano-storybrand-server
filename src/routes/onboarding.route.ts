import { Router } from 'express';
import {
  getOnboardingOptions,
  createOrUpdateOnboardingContext,
  getOnboardingContext,
  checkOnboardingStatus,
  deleteOnboardingContext
} from '../controllers/onboarding.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

/**
 * @route GET /api/onboarding/options
 * @desc Obtener todas las opciones disponibles para el onboarding
 * @access Public (no requiere autenticación)
 */
router.get('/options', getOnboardingOptions);

/**
 * @route POST /api/onboarding/business/:businessId
 * @desc Crear o actualizar el contexto de onboarding para un business
 * @access Private
 */
router.post('/business/:businessId', authMiddleware, createOrUpdateOnboardingContext);

/**
 * @route PUT /api/onboarding/business/:businessId
 * @desc Actualizar el contexto de onboarding para un business
 * @access Private
 */
router.put('/business/:businessId', authMiddleware, createOrUpdateOnboardingContext);

/**
 * @route GET /api/onboarding/business/:businessId
 * @desc Obtener el contexto de onboarding para un business
 * @access Private
 */
router.get('/business/:businessId', authMiddleware, getOnboardingContext);

/**
 * @route GET /api/onboarding/business/:businessId/status
 * @desc Verificar el estado de completitud del onboarding
 * @access Private
 */
router.get('/business/:businessId/status', authMiddleware, checkOnboardingStatus);

/**
 * @route DELETE /api/onboarding/business/:businessId
 * @desc Eliminar el contexto de onboarding para un business
 * @access Private
 */
router.delete('/business/:businessId', authMiddleware, deleteOnboardingContext);

export default router;