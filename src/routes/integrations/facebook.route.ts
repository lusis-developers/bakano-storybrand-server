import express from "express"
import { facebookConnectController, facebookSavePageController, getFacebookPostsController } from "../../controllers/integrations/facebook.controller"

const router = express.Router()

router.post('/connect', facebookConnectController)

router.post('/connect-page', facebookSavePageController)

router.post('/posts/:businessId', getFacebookPostsController)
export default router