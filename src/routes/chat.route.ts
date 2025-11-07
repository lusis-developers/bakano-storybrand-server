import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import {
	createChatController,
	getChatsController,
	getChatByIdController,
	addUserMessageController,
	generateAssistantReplyController,
} from "../controllers/chat.controller";

const router = Router();

router.use(authMiddleware);

/**
 * @route GET /api/chats
 * @desc Obtener lista de conversaciones del usuario (con filtros y paginación)
 * @access Private
 */
router.get("/", getChatsController);

/**
 * @route GET /api/chats/:id
 * @desc Obtener una conversación por ID (para seguir el hilo)
 * @access Private
 */
router.get("/:id", getChatByIdController);

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
