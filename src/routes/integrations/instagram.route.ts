import express from "express"
import { instagramConnectController, instagramSavePageController, getinstagramPostsController } from "../../controllers/integrations/instagram.controler";

const router = express.Router()

router.post('/connect', instagramConnectController)

router.post('/connect-page', instagramSavePageController)

router.get('/posts/:businessId', getinstagramPostsController)
export default router