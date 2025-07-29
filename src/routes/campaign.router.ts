import { Router } from 'express';
import {
  getAvailableAssets,
  createCampaign,
  getCampaigns,
  getCampaignById,
  generateAssetContent,
  updateCampaignStatus,
  deleteCampaign
} from '../controllers/campaign.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Get all available assets organized by category
router.get('/assets', getAvailableAssets);

// Campaign CRUD operations
router.post('/', createCampaign);
router.get('/', getCampaigns);
router.get('/:campaignId', getCampaignById);
router.patch('/:campaignId/status', updateCampaignStatus);
router.delete('/:campaignId', deleteCampaign);

// Asset generation
router.post('/:campaignId/assets/:assetType/generate', generateAssetContent);

export default router;