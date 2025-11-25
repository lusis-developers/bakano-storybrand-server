import express from "express";
import {
  listAdAccountsController,
  saveAdAccountController,
  saveUserAccessTokenController,
} from "../../controllers/integrations/facebook-marketing.controller";

const router = express.Router();

router.get("/adaccounts/:businessId", listAdAccountsController);
router.post("/adaccounts/:businessId/select", saveAdAccountController);
router.post("/adaccounts/:businessId/user-token", saveUserAccessTokenController);

export default router;

