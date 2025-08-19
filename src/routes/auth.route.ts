import express from 'express'
import { loginUserController, registerUserController, verifyUserController, createAdminController } from '../controllers/auth.controller'

const router = express.Router()

// Authentication routes
router.post('/register', registerUserController)
router.post('/login', loginUserController)
router.get('/verify/:token', verifyUserController)
router.post('/create-admin', createAdminController)

export default router
