import express from 'express'
import { createUserController, deleteUserController, getUserByIdController, updateUserController } from '../controllers/user.controller'

const router = express.Router()

router.post('/user', createUserController)
router.get('/user/:id', getUserByIdController)
router.put('/user/:id', updateUserController)
router.delete('/user/:id', deleteUserController)


export default router
