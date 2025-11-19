import express from "express"
import { instagramConnectController, instagramSavePageController, getinstagramPostsController, createInstagramPhotoPostController, createInstagramReelController, testInstagramPublishController, getInstagramPageMetricsController, getInstagramFollowersMetricsController } from "../../controllers/integrations/instagram.controler";
import multer from "multer";


const storage = multer.memoryStorage();
const uploadMemory = multer({ storage: storage }); 

const router = express.Router()

router.post('/connect', instagramConnectController)

router.post('/connect-page', instagramSavePageController)

router.get('/posts/:businessId', getinstagramPostsController)

router.get('/metrics/:businessId', getInstagramPageMetricsController)

router.get('/metrics/followers/:businessId', getInstagramFollowersMetricsController)

router.post(
  '/post/publish/photo/:businessId',
  uploadMemory.array('images', 10),
  createInstagramPhotoPostController
);

router.post(
  '/post/publish/reel/:businessId',
  uploadMemory.single('video'),
  createInstagramReelController
);

router.post('/post/test/:businessId', testInstagramPublishController)
export default router