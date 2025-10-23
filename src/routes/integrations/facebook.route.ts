import express from "express"
import { createPostController, facebookConnectController, facebookSavePageController, getFacebookPostsController } from "../../controllers/integrations/facebook.controller"

const router = express.Router()

router.post('/connect', facebookConnectController)

router.post('/connect-page', facebookSavePageController)

router.post('/posts/:businessId', getFacebookPostsController)

router.post('/post/publish/text/:businessId', createPostController)

export default router