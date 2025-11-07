import type { IChat, IMessage, MessageRole } from "../models/chat.model";
import { aiChatService } from "./aiChat.service";
import CustomError from "../errors/customError.error";
import { HttpStatusCode } from "axios";
import { Types } from "mongoose";
import { instagramService } from "./instagram.service";
import { facebookService } from "./facebook.service";
import type { IIntegration } from "../models/integration.model";
import models from "../models";

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
		// Prompt de sistema enfocado 100% a métricas del negocio y acciones
		const baseSystemPrompt =
			chat.systemPrompt ||
			"Actúa como asesor de growth y revenue. Tu única prioridad es mejorar los KPIs del negocio: Leads, MQL/SQL, CTR, Conversion Rate, CAC, ROAS, LTV, Revenue y Retención. \n\n" +
				"Reglas: \n" +
				"- Responde SIEMPRE en español, de forma clara, específica y accionable.\n" +
				"- NO hables de problemas técnicos del modelo, API, claves, proveedores, logs o límites; nunca hagas troubleshooting de la plataforma.\n" +
				"- Si el usuario saluda o no da contexto, pide una métrica objetivo y la línea base (últimos 7-30 días) y propone 3 acciones inmediatas.\n" +
				"- Aterriza cualquier conversación en: objetivo KPI → hipótesis → experimento → medición.\n\n" +
				"Requisito de referencias: Siempre que cites métricas o contenido de IG/FB, añade al final una sección 'Referencias de publicaciones' listando, para cada post mencionado, su postId y su permalink (Instagram: permalink; Facebook: permalink_url). Si no se citan posts específicos, incluye al menos los 3 últimos relevantes del dataset.\n\n" +
				"Formato obligatorio de respuesta: \n" +
				"1) Objetivo KPI y línea base\n" +
				"2) Insight clave (qué está pasando y por qué)\n" +
				"3) Acciones próximos 7 días (3-5 bullets con responsable, esfuerzo, herramienta)\n" +
				"4) Impacto estimado y cómo medir (métrica, fuente y cadencia)\n" +
				"5) Riesgos y mitigaciones\n\n" +
				"Si hay datos de IG/FB, utiliza engagement, alcance, CTR y conversiones para justificar cada recomendación.";
		const context = this._buildSafeContext(chat, 30);
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

		// Si la respuesta no sigue el formato de métricas de negocio o contiene troubleshooting técnico,
		// intentamos una segunda reformulación forzada.
		if (this._needsKPIRefocus(aiResult.content)) {
			try {
				console.warn(
					"[ChatService] Reformulando respuesta para alinearla a KPIs y evitar troubleshooting técnico"
				);
				const refocused = await aiChatService.generateChatCompletion(
					this._buildRefocusPrompt(enrichedSystemPrompt),
					context,
					{
						temperature,
						maxTokens,
						model: model || chat.aiModel,
						primaryProvider: chat.aiProvider,
					}
				);
				if (refocused?.content) {
					aiResult.content = refocused.content;
				}
			} catch (refocusErr) {
				console.warn(
					"[ChatService] Falló la reformulación. Continuamos con la respuesta original",
					refocusErr
				);
			}
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

	private _buildSafeContext(
		chat: IChat,
		limit: number
	): Array<{ role: MessageRole; content: string }> {
		// Toma el contexto y elimina mensajes del asistente con troubleshooting técnico
		const raw = chat.getContextForAI(limit);
		const bannedPatterns = [
			/\bapi\b/i,
			/\bmodelo\b/i,
			/\bmodel\b/i,
			/\bclave\b|\bapi key\b|\bllave\b/i,
			/\brate limit\b|\blímite\b/i,
			/\blog\b|\bregistro\b/i,
			/\berror\b|\b404\b|\b401\b|\bNOT_FOUND\b/i,
			/\breinicia\b|\brestart\b/i,
		];
		return raw.filter((m) => {
			if (m.role !== "assistant") return true;
			// Excluir respuestas del asistente que parezcan troubleshooting técnico
			return !bannedPatterns.some((re) => re.test(m.content));
		});
	}

	private _needsKPIRefocus(content: string): boolean {
		if (!content) return true;
		const bannedPatterns = [
			/\bapi\b/i,
			/\bmodelo\b|\bmodel\b/i,
			/\bclave\b|\bapi key\b|\bllave\b/i,
			/\brate limit\b|\blímite\b/i,
			/\blog\b|\bregistro\b/i,
			/\berror\b|\b404\b|\b401\b|\bNOT_FOUND\b/i,
			/\breinicia\b|\brestart\b/i,
		];
		const lacksStructure = !(/Objetivo KPI/i.test(content) && /Acciones próximos 7 días/i.test(content));
		const containsTroubleshooting = bannedPatterns.some((re) => re.test(content));
		// Exigir referencias de publicaciones con postId y permalink/permalink_url
		const hasReferencesSection = /Referencias de publicaciones/i.test(content);
		const hasPermalink = /(permalink|https?:\/\/(www\.)?(instagram\.com|facebook\.com)\/)/i.test(content);
		const hasPostIdMention = /(post\s*id|media\s*id|\bID\b)\s*[:#]?/i.test(content);
		const missingReferences = !(hasReferencesSection && hasPermalink && hasPostIdMention);
		return lacksStructure || containsTroubleshooting || missingReferences;
	}

	private _buildRefocusPrompt(originalPrompt: string): string {
		return (
			originalPrompt +
			"\n\nINSTRUCCIÓN ADICIONAL: Responde exclusivamente siguiendo el formato indicado (Objetivo KPI, Insight, Acciones próximos 7 días, Impacto y medición, Riesgos). No menciones API, modelos, claves, logs ni problemas técnicos. Si el usuario sólo saluda, solicita KPI objetivo y línea base y propone 3 acciones inmediatas. Añade al final una sección 'Referencias de publicaciones' con postId y permalink/permalink_url de cada post citado o, en su defecto, de los 3 últimos relevantes."
		);
	}

	private async _enrichSystemPrompt(
		chat: IChat,
		originalPrompt: string
	): Promise<string> {
 		// Intentar usar la integración del chat; si no existe o no está conectada,
 		// buscar una integración de respaldo del negocio según el origen del chat.
 		let resolvedIntegration = chat.integration as
 			| (IIntegration & { _id: Types.ObjectId })
 			| undefined;

 		let token = resolvedIntegration?.config?.accessToken;
 		if (!resolvedIntegration?.isConnected || !token) {
 			const typesToTry: Array<'instagram' | 'facebook'> =
 				chat.source === 'instagram'
 					? ['instagram']
 					: chat.source === 'facebook'
 					? ['facebook']
 					: ['instagram', 'facebook'];

 			try {
 				const fallbacks = await models.integration
 					.find({ business: chat.business, isConnected: true, type: { $in: typesToTry } })
 					.select('+config.accessToken metadata isConnected')
 					.sort({ createdAt: -1 });

 				const candidate = fallbacks.find((intg: any) => !!intg?.config?.accessToken);
 				if (candidate) {
 					resolvedIntegration = candidate as unknown as IIntegration & { _id: Types.ObjectId };
 					token = String(candidate.config.accessToken);
 					console.info('[ChatService] Usando integración de respaldo para enriquecer contexto', {
 						chatId: chat._id,
 						integrationId: candidate._id,
 						type: candidate.type,
 					});
 
 					// Persistir la relación en el chat si no estaba definida
 					if (!chat.integration) {
 						chat.integration = candidate._id as Types.ObjectId;
 						try { await chat.save(); } catch (e) {
 							console.warn('[ChatService] No se pudo persistir la integración en el chat:', (e as Error).message);
 						}
 					}
 				} else {
 					console.warn(
 						`[ChatService] DEBUG: Enriquecimiento OMITIDO. Razón: Chat sin integración conectada o sin token, y no se encontró respaldo para el negocio.`,
 						{
 							chatId: chat._id,
 							integrationExists: !!resolvedIntegration,
 							isConnected: resolvedIntegration?.isConnected,
 							tokenExists: !!token,
 						}
 					);
 					// Instrucción para el asistente cuando no hay integraciones conectadas
 					return (
 						originalPrompt +
 						"\n\nSi el negocio no tiene sus redes conectadas, indica al usuario que vaya a Gestión de negocio → Integraciones y conecte Instagram/Facebook para poder analizar métricas y contenido."
 					);
 				}
 			} catch (e) {
 				console.error('[ChatService] Error buscando integración de respaldo:', (e as Error).message);
 				return (
 					originalPrompt +
 					"\n\nSi el negocio no tiene sus redes conectadas, indica al usuario que vaya a Gestión de negocio → Integraciones y conecte Instagram/Facebook para poder analizar métricas y contenido."
 				);
 			}
 		}

		const igUserId = resolvedIntegration?.metadata?.instagramAccountId;
		const fbPageId = resolvedIntegration?.metadata?.pageId;
		const dataContext: any = {};

		try {
			if (
				(chat.source === "instagram" || chat.source === "internal") &&
				igUserId
			) {
				const posts = await instagramService.getUserMedia(
					igUserId,
					token!,
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
						permalink: p.permalink,
						media_url: p.media_url,
						caption: p.caption?.substring(0, 50) + "...",
						media_type: p.media_type,
						timestamp: p.timestamp,
						like_count: (p as any).like_count,
						comments_count: (p as any).comments_count,
						insights: insights.get(p.id) || null,
					})),
				};
			}

			if (
				(chat.source === "facebook" || chat.source === "internal") &&
				fbPageId
			) {
				const posts = await facebookService.getPagePosts(
					token!,
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
						permalink_url: p.permalink_url,
						full_picture: p.full_picture,
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

			// Construir métricas resumen agregadas para facilitar la línea base de KPIs
			const metricsSummary: any = {};
			if (dataContext.instagram?.recentPosts?.length) {
				const posts = dataContext.instagram.recentPosts;
				const count = posts.length;
				const sum = posts.reduce(
					(acc: any, p: any) => {
						const ins = p.insights || {};
						const likes = typeof p.like_count === 'number' ? p.like_count : 0;
						const comments = typeof p.comments_count === 'number' ? p.comments_count : 0;
						acc.reach += Number(ins.reach || 0);
						acc.engagement += Number(ins.engagement || (likes + comments + Number(ins.saved || 0)) || 0);
						acc.saved += Number(ins.saved || 0);
						return acc;
					},
					{ reach: 0, engagement: 0, saved: 0 }
				);
				const avgReach = count ? Math.round(sum.reach / count) : 0;
				const avgEngagement = count ? Math.round(sum.engagement / count) : 0;
				const engagementRate = sum.reach > 0 ? Number(((sum.engagement / sum.reach) * 100).toFixed(2)) : 0;
				metricsSummary.instagram = {
					postsCount: count,
					reachTotal: sum.reach,
					reachAvg: avgReach,
					engagementTotal: sum.engagement,
					engagementAvg: avgEngagement,
					engagementRatePct: engagementRate,
					savedTotal: sum.saved,
				};
			}

			if (dataContext.facebook?.recentPosts?.length) {
				const posts = dataContext.facebook.recentPosts;
				const count = posts.length;
				const sum = posts.reduce(
					(acc: any, p: any) => {
						const ins = p.insights || {};
						acc.reach += Number(ins.reach || 0);
						acc.impressions += Number(ins.impressions || 0);
						acc.engagement += Number(ins.engagement || 0);
						return acc;
					},
					{ reach: 0, impressions: 0, engagement: 0 }
				);
				const avgReach = count ? Math.round(sum.reach / count) : 0;
				const avgImpressions = count ? Math.round(sum.impressions / count) : 0;
				const avgEngagement = count ? Math.round(sum.engagement / count) : 0;
				metricsSummary.facebook = {
					postsCount: count,
					reachTotal: sum.reach,
					reachAvg: avgReach,
					impressionsTotal: sum.impressions,
					impressionsAvg: avgImpressions,
					engagementTotal: sum.engagement,
					engagementAvg: avgEngagement,
				};
			}

			const dataString = JSON.stringify({ metricsSummary, ...dataContext }, null, 2);

			return `${originalPrompt}

---
CONTEXTO DE DATOS (NO MOSTRAR AL USUARIO):
Aquí tienes los datos más recientes de las cuentas conectadas y un resumen agregado de métricas. Usa esta información para fijar línea base y justificar recomendaciones sobre métricas, rendimiento o contenido. No pidas datos que ya se proporcionan aquí.

IMPORTANTE: Cuando cites métricas o ejemplos, referencia los posts mediante su postId y su permalink/permalink_url. Ejemplo de sección al final de tu respuesta:

Referencias de publicaciones:
- Instagram: postId=178987654321, permalink=https://www.instagram.com/p/ABCDEFG/
- Facebook: postId=1234567890_0987654321, permalink_url=https://www.facebook.com/username/posts/1234567890

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
