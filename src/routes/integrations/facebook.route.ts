import express from "express"
import { createFacebookPhotoPostController, createFacebookVideoPostController, createPostController, facebookConnectController, facebookSavePageController, getFacebookPostsController, getFacebookScheduledPostsController } from "../../controllers/integrations/facebook.controller"
import { getFacebookPageMetricsController } from "../../controllers/integrations/facebook.controller"

import multer from "multer";

const storage = multer.memoryStorage(); // <-- USA memoryStorage()
const uploadMemory = multer({ storage: storage })

const router = express.Router()

router.post('/connect', facebookConnectController)

router.post('/connect-page', facebookSavePageController)

router.get('/posts/:businessId', getFacebookPostsController)

router.get('/posts/scheduled/:businessId', getFacebookScheduledPostsController)
router.get('/metrics/:businessId', getFacebookPageMetricsController)

router.post('/post/publish/text/:businessId', createPostController)

router.post('/post/publish/photo/:businessId', uploadMemory.array('images', 10), createFacebookPhotoPostController)

router.post(
  '/post/publish/video/:businessId',
  uploadMemory.single('video'),
  createFacebookVideoPostController
);

export default router