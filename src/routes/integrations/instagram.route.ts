import express from "express"
import { instagramConnectController, instagramSavePageController, getinstagramPostsController, createInstagramPhotoPostController, createInstagramReelController } from "../../controllers/integrations/instagram.controler";
import multer from "multer";


const storage = multer.memoryStorage();
const uploadMemory = multer({ storage: storage }); 

const router = express.Router()

router.post('/connect', instagramConnectController)

router.post('/connect-page', instagramSavePageController)

router.get('/posts/:businessId', getinstagramPostsController)

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
export default router