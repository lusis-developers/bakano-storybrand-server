import express from 'express'
import { createUserController, deleteUserController, getUserByIdController } from '../controllers/user.controller'

const router = express.Router()

router.post('/user', createUserController)
router.get('/user/:id', getUserByIdController)
router.delete('/user/:id', deleteUserController)


export default router
