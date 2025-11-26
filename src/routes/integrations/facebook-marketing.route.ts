import express from "express";
import {
  listAdAccountsController,
  saveAdAccountController,
  saveUserAccessTokenController,
  getAdsStatisticsController,
  getAdsWithLinksAndMetricsController,
  getTopAdController,
} from "../../controllers/integrations/facebook-marketing.controller";

const router = express.Router();

router.get("/adaccounts/:businessId", listAdAccountsController);
router.post("/adaccounts/:businessId/select", saveAdAccountController);
router.post("/adaccounts/:businessId/user-token", saveUserAccessTokenController);
router.get("/insights/:businessId", getAdsStatisticsController);
router.get("/ads/:businessId", getAdsWithLinksAndMetricsController);
router.get("/ads/top/:businessId", getTopAdController);

export default router;
