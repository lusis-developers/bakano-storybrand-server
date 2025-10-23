import express from "express"
import { createFacebookPhotoPostController, createPostController, facebookConnectController, facebookSavePageController, getFacebookPostsController } from "../../controllers/integrations/facebook.controller"

import multer from "multer";

const storage = multer.memoryStorage(); // <-- USA memoryStorage()
const uploadMemory = multer({ storage: storage })

const router = express.Router()

router.post('/connect', facebookConnectController)

router.post('/connect-page', facebookSavePageController)

router.post('/posts/:businessId', getFacebookPostsController)

router.post('/post/publish/text/:businessId', createPostController)

router.post('/post/publish/photo/:businessId', uploadMemory.array('images', 10), createFacebookPhotoPostController)

export default router