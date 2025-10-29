import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import {
	createChatController,
	addUserMessageController,
	generateAssistantReplyController,
} from "../controllers/chat.controller";

const router = Router();

router.use(authMiddleware);

/**
 * @route POST /api/chats
 * @desc Crear un nuevo chat
 * @access Private
 */
router.post("/", createChatController);

/**
 * @route POST /api/chats/:id/messages
 * @desc Agregar un mensaje del usuario al chat
 * @access Private
 */
router.post("/:id/messages", addUserMessageController);

/**
 * @route POST /api/chats/:id/reply
 * @desc Generar respuesta de la IA y añadirla al chat
 * @access Private
 */
router.post("/:id/reply", generateAssistantReplyController);

export default router;
