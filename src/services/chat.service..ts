import type { IChat, IMessage } from "../models/chat.model";
import { aiChatService } from "./aiChat.service";
import CustomError from "../errors/customError.error";
import { HttpStatusCode } from "axios";
import { Types } from "mongoose";
import { instagramService } from "./instagram.service";
import { facebookService } from "./facebook.service";
import type { IIntegration } from "../models/integration.model";

interface IReplyConfig {
	temperature?: number;
	maxTokens?: number;
	model?: string;
}
interface IReplyResult {
	reply: string;
	usage: IChat["usage"];
	lastMessageAt: IChat["lastMessageAt"];
}

export class ChatService {
	async generateAndSaveReply(
		chat: IChat,
		config: IReplyConfig = {}
	): Promise<IReplyResult> {
		const { temperature = 0.7, maxTokens = 1200, model } = config;
		const baseSystemPrompt =
			chat.systemPrompt ||
			"Eres un asistente de marketing que analiza métricas y contenido de IG/FB y recomienda acciones claras y accionables para el usuario.";
		const context = chat.getContextForAI(30);
		const enrichedSystemPrompt = await this._enrichSystemPrompt(
			chat,
			baseSystemPrompt
		);

		let aiResult;
		try {
			aiResult = await aiChatService.generateChatCompletion(
				enrichedSystemPrompt,
				context,
				{
					temperature,
					maxTokens,
					model: model || chat.aiModel,
					primaryProvider: chat.aiProvider,
				}
			);
		} catch (error: any) {
			console.error(
				"[ChatService] Error llamando a AIChatService:",
				error
			);
			chat.addMessage({
				role: "assistant",
				content: "[Error al generar respuesta]",
				error: { message: error.message || "Unknown AI Error" },
			});
			await chat.save();
			throw new CustomError(
				`AI provider error: ${error.message}`,
				HttpStatusCode.InternalServerError
			);
		}

		const aiMeta: IMessage["ai"] = {
			provider: aiResult.providerUsed,
			model: aiResult.modelUsed,
			promptTokens: aiResult.usage?.promptTokens,
			completionTokens: aiResult.usage?.completionTokens,
			totalTokens: aiResult.usage?.totalTokens,
		};

		chat.addMessage({
			role: "assistant",
			content: aiResult.content.trim(),
			ai: aiMeta,
		});

		await chat.save();

		return {
			reply: aiResult.content,
			usage: chat.usage,
			lastMessageAt: chat.lastMessageAt,
		};
	}

	private async _enrichSystemPrompt(
		chat: IChat,
		originalPrompt: string
	): Promise<string> {
		const integration = chat.integration as
			| (IIntegration & { _id: Types.ObjectId })
			| undefined;

		const token = integration?.config?.accessToken;
		if (!integration?.isConnected || !token) {
			console.warn(
				`[ChatService] DEBUG: Enriquecimiento OMITIDO. Razón: Chat sin integración conectada o sin token.`,
				{
					chatId: chat._id,
					integrationExists: !!integration,
					isConnected: integration?.isConnected,
					tokenExists: !!token,
				}
			);
			return originalPrompt;
		}

		const igUserId = integration.metadata?.instagramAccountId;
		const fbPageId = integration.metadata?.pageId;
		const dataContext: any = {};

		try {
			if (
				(chat.source === "instagram" || chat.source === "internal") &&
				igUserId
			) {
				const posts = await instagramService.getUserMedia(
					igUserId,
					token,
					5
				);
				const postIds = posts.map((p) => p.id);
				const insights =
					await instagramService.getMultipleMediaInsights(
						postIds,
						token
					);
				dataContext.instagram = {
					recentPosts: posts.map((p) => ({
						id: p.id,
						caption: p.caption?.substring(0, 50) + "...",
						media_type: p.media_type,
						timestamp: p.timestamp,
						insights: insights.get(p.id) || null,
					})),
				};
			}

			if (
				(chat.source === "facebook" || chat.source === "internal") &&
				fbPageId
			) {
				const posts = await facebookService.getPagePosts(
					token,
					fbPageId,
					5
				);
				const postIds = posts.map((p) => p.id);
				const insights = await facebookService.getPostsInsights(
					token,
					postIds
				);
				dataContext.facebook = {
					recentPosts: posts.map((p) => ({
						id: p.id,
						message: p.message?.substring(0, 50) + "...",
						created_time: p.created_time,
						insights: insights.get(p.id) || null,
					})),
				};
			}

			if (Object.keys(dataContext).length === 0) {
				console.warn(
					`[ChatService] DEBUG: Enriquecimiento OMITIDO. Razón: No se encontraron datos para los IDs/fuente proporcionados.`,
					{
						chatId: chat._id,
						igUserId,
						fbPageId,
						source: chat.source,
					}
				);
				return originalPrompt;
			}

			const dataString = JSON.stringify(dataContext, null, 2);

			return `${originalPrompt}

---
CONTEXTO DE DATOS (NO MOSTRAR AL USUARIO):
Aquí tienes los datos más recientes de las cuentas conectadas. Usa esta información para responder las preguntas del usuario sobre métricas, rendimiento o contenido. No pidas datos que ya se proporcionan aquí.

${dataString}
---
`;
		} catch (error: any) {
			console.error(
				"[ChatService] Error al enriquecer el prompt:",
				error.message
			);
			return originalPrompt;
		}
	}
}

export const chatService = new ChatService();
