import express from 'express';
import {
  createBusinessController,
  getBusinessesController,
  getBusinessByIdController,
  updateBusinessController,
  deleteBusinessController,
  addEmployeeController,
  removeEmployeeController
} from '../controllers/business.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

// CRUD básico para negocios
router.post('/', createBusinessController);
router.get('/', getBusinessesController);
router.get('/:id', getBusinessByIdController);
router.put('/:id', updateBusinessController);
router.delete('/:id', deleteBusinessController);

// Gestión de empleados
router.post('/:id/employees', addEmployeeController);
router.delete('/:id/employees/:employeeId', removeEmployeeController);

export default router;