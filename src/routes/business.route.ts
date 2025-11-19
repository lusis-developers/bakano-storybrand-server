import express from 'express';
import {
  createBusinessController,
  getBusinessesController,
  getBusinessByIdController,
  updateBusinessController,
  deleteBusinessController,
  addEmployeeController,
  removeEmployeeController,
  inviteTeamMemberController,
  acceptTeamInviteController,
  listTeamMembersController,
  updateTeamMemberRoleController,
  revokeTeamMemberController,
  listTeamAuditController,
  canCreateBusinessController
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

router.post('/:id/team/invite', inviteTeamMemberController);
router.post('/:id/team/accept', acceptTeamInviteController);
router.get('/:id/team', listTeamMembersController);
router.patch('/:id/team/:userId/role', updateTeamMemberRoleController);
router.delete('/:id/team/:userId/revoke', revokeTeamMemberController);
router.get('/:id/team/audit', listTeamAuditController);
router.get('/quota/can-create', canCreateBusinessController);

export default router;