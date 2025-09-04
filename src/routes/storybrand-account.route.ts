import express from 'express';
import { 
  createStorybrandAccountController,
  adminChangePasswordController,
  adminDeleteUserAccountController
} from '../controllers/storybrand-account.controller';

const router = express.Router();

// Public StoryBrand Account routes
router.post('/', createStorybrandAccountController);

// Admin routes - require authentication
router.put('/password', adminChangePasswordController);
router.delete('/:userId', adminDeleteUserAccountController);

export default router;