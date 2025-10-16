import express from "express"
import { facebookConnectController } from "../controllers/integration.controller"

const router = express.Router()

router.post('/facebook-connect', facebookConnectController)

export default router