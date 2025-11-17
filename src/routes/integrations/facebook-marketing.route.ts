import express from "express";
import {
  listAdAccountsController,
  saveAdAccountController,
  saveUserAccessTokenController,
  orchestrateCampaignController,
} from "../../controllers/integrations/facebook-marketing.controller";

const router = express.Router();

router.get("/adaccounts/:businessId", listAdAccountsController);
router.post("/adaccounts/:businessId/select", saveAdAccountController);
router.post("/adaccounts/:businessId/user-token", saveUserAccessTokenController);
router.post("/orchestrate/:businessId", orchestrateCampaignController);

export default router;

