import express from "express"
import { getIntegrationsController } from "../../controllers/integrations/index.controller"

const router = express.Router()


router.get("/:businessId", getIntegrationsController)

export default router
