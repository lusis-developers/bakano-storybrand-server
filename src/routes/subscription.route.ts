import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import {
  getMySubscriptionController,
  listMySubscriptionsController,
  startSubscriptionController,
  cancelMySubscriptionController,
  getPlansController,
} from '../controllers/subscription.controller';

const router = Router();

// Info rápida del usuario (snapshot + datos derivados)
router.get('/me', authMiddleware, getMySubscriptionController);

// Historial/listado de suscripciones del usuario
router.get('/', authMiddleware, listMySubscriptionsController);

// Iniciar compra/suscripción (plan de pago, provider, intervalo, trial opcional)
router.post('/start', authMiddleware, startSubscriptionController);

// Cancelar suscripción (inmediata o al final del periodo)
router.post('/cancel', authMiddleware, cancelMySubscriptionController);

// Planes disponibles (público)
router.get('/plans', getPlansController);

export default router;