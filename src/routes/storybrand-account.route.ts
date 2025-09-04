import express from 'express';
import { createStorybrandAccountController } from '../controllers/storybrand-account.controller';

const router = express.Router();

// StoryBrand Account routes
router.post('/', createStorybrandAccountController);

export default router;