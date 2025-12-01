import type { Response, NextFunction } from "express";
import { HttpStatusCode } from "axios";
import { Types } from "mongoose";
import type { AuthRequest } from "../types/AuthRequest";
import models from "../models";
import CustomError from "../errors/customError.error";
import { chatService } from "../services/chat.service.";

async function getAuthorizedChat(chatId: string, userId?: string) {
	if (!Types.ObjectId.isValid(chatId)) {
		throw new Error("INVALID_ID");
	}

	const chat = await models.chat
		.findById(chatId)
		.select("+systemPrompt")
		.populate("business", "owner")
		.populate({
			path: "integration",
			select: "+config.accessToken metadata isConnected",
		});

	if (!chat) {
		throw new Error("NOT_FOUND");
	}
	if (!userId) {
		throw new Error("UNAUTHORIZED");
	}

	const business = chat.business as any;
	if (!business || business.owner.toString() !== userId) {
		throw new Error("FORBIDDEN");
	}

	return chat;
}

export async function createChatController(
	req: AuthRequest,
	res: Response,
	next: NextFunction
): Promise<void> {
	try {
		const userId = req.user?.id;
		const {
			businessId,
			purpose,
			source,
			aiProvider,
			aiModel,
			systemPrompt,
			participants,
			integrationId,
		} = req.body as {
			businessId?: string;
			purpose?: "analytics" | "content" | "support" | "general";
			source?: "internal" | "facebook" | "instagram";
			aiProvider?: "openai" | "gemini";
			aiModel?: string;
			systemPrompt?: string;
			participants?: string[];
			integrationId?: string;
		};

		if (!userId) {
			return next(
				new CustomError(
					"User authentication required.",
					HttpStatusCode.Unauthorized
				)
			);
		}

		if (!businessId) {
			return next(
				new CustomError(
					"Business ID is required.",
					HttpStatusCode.BadRequest
				)
			);
		}

		if (!Types.ObjectId.isValid(businessId)) {
			return next(
				new CustomError(
					"Invalid business ID format.",
					HttpStatusCode.BadRequest
				)
			);
		}

		const business = await models.business
			.findById(businessId)
			.select("owner");
		if (!business) {
			return next(
				new CustomError("Business not found.", HttpStatusCode.NotFound)
			);
		}
		if (business.owner.toString() !== userId) {
			return next(
				new CustomError(
					"Access denied to this business.",
					HttpStatusCode.Forbidden
				)
			);
		}

		const allowedProviders = ["openai", "gemini"] as const;
		const allowedSources = ["internal", "facebook", "instagram"] as const;
		const allowedPurposes = [
			"analytics",
			"content",
			"support",
			"general",
		] as const;

		if (aiProvider && !allowedProviders.includes(aiProvider)) {
			return next(
				new CustomError(
					"Invalid AI provider.",
					HttpStatusCode.BadRequest
				)
			);
		}
		if (source && !allowedSources.includes(source)) {
			return next(
				new CustomError(
					"Invalid chat source.",
					HttpStatusCode.BadRequest
				)
			);
		}
		if (purpose && !allowedPurposes.includes(purpose)) {
			return next(
				new CustomError(
					"Invalid chat purpose.",
					HttpStatusCode.BadRequest
				)
			);
		}

		let integrationObjId: Types.ObjectId | undefined;
		if (integrationId) {
			if (!Types.ObjectId.isValid(integrationId)) {
				return next(
					new CustomError(
						"Invalid integration ID format.",
						HttpStatusCode.BadRequest
					)
				);
			}
			integrationObjId = new Types.ObjectId(integrationId);
		}

		// Vinculación profesional automática de integración cuando no se especifica integrationId
		if (!integrationObjId) {
			const typesToTry: Array<'instagram' | 'facebook'> =
				source === 'instagram'
					? ['instagram']
					: source === 'facebook'
					? ['facebook']
					: ['instagram', 'facebook'];

			try {
				const fallbackIntegrations = await models.integration
					.find({ business: new Types.ObjectId(businessId), isConnected: true, type: { $in: typesToTry } })
					.select('_id type isConnected createdAt')
					.sort({ createdAt: -1 })
					.lean();

				const candidate = fallbackIntegrations[0];
				if (candidate?._id) {
					integrationObjId = candidate._id as Types.ObjectId;
					console.info('[createChatController] Integración vinculada automáticamente al chat', {
						businessId,
						integrationId: String(candidate._id),
						type: candidate.type,
					});
				}
			} catch (e) {
				console.warn('[createChatController] No se pudo vincular integración automáticamente:', (e as Error).message);
			}
		}

		const participantIds: Types.ObjectId[] = Array.isArray(participants)
			? participants
					.filter((p) => Types.ObjectId.isValid(p))
					.map((p) => new Types.ObjectId(p))
			: [];
		if (!participantIds.find((p) => p.toString() === userId)) {
			participantIds.push(new Types.ObjectId(userId));
		}

		const newChat = new models.chat({
			business: new Types.ObjectId(businessId),
			participants: participantIds,
			integration: integrationObjId,
			source: source || "internal",
			purpose: purpose || "general",
			aiProvider: aiProvider || "gemini",
			aiModel: aiModel?.trim(),
			messages: [],
		});

		const savedChat = await newChat.save();

		res.status(HttpStatusCode.Created).send({
			message: "Chat created successfully",
			data: {
				id: savedChat._id,
				business: savedChat.business,
				participants: savedChat.participants,
				source: savedChat.source,
				purpose: savedChat.purpose,
				aiProvider: savedChat.aiProvider,
				aiModel: savedChat.aiModel,
				status: savedChat.status,
				createdAt: savedChat.createdAt,
			},
		});
	} catch (error) {
		console.error("Error creating chat:", error);
		next(error);
	}
}

/**
 * Lista las conversaciones del usuario autenticado.
 * Soporta filtros y paginación profesionales.
 *
 * Query params:
 * - businessId?: string (opcional, debe pertenecer al usuario)
 * - status?: "active" | "archived" | "closed"
 * - source?: "internal" | "facebook" | "instagram"
 * - purpose?: "analytics" | "content" | "support" | "general"
 * - q?: string (búsqueda básica por contenido de mensajes)
 * - page?: number (default 1)
 * - limit?: number (default 20, max 100)
 * - sort?: "lastMessageAt_desc" | "lastMessageAt_asc" | "createdAt_desc" | "createdAt_asc"
 */
export async function getChatsController(
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return next(
                new CustomError(
                    "User authentication required.",
                    HttpStatusCode.Unauthorized
                )
            );
        }

        const {
            businessId,
            status,
            source,
            purpose,
            q,
        } = req.query as {
            businessId?: string;
            status?: "active" | "archived" | "closed";
            source?: "internal" | "facebook" | "instagram";
            purpose?: "analytics" | "content" | "support" | "general";
            q?: string;
        };

        // Paginación y orden
        const page = Math.max(parseInt(String(req.query.page || 1), 10) || 1, 1);
        const limit = Math.min(
            Math.max(parseInt(String(req.query.limit || 20), 10) || 20, 1),
            100
        );
        const skip = (page - 1) * limit;

        const sortParam = String(
            req.query.sort || "lastMessageAt_desc"
        ) as
            | "lastMessageAt_desc"
            | "lastMessageAt_asc"
            | "createdAt_desc"
            | "createdAt_asc";
        let sort: Record<string, 1 | -1> = { lastMessageAt: -1 };
        switch (sortParam) {
            case "lastMessageAt_asc":
                sort = { lastMessageAt: 1 };
                break;
            case "createdAt_desc":
                sort = { createdAt: -1 };
                break;
            case "createdAt_asc":
                sort = { createdAt: 1 };
                break;
            default:
                sort = { lastMessageAt: -1 };
        }

        // Resolver businessIds permitidos para el usuario
        let businessIds: Types.ObjectId[] = [];
        if (businessId) {
            if (!Types.ObjectId.isValid(businessId)) {
                return next(
                    new CustomError(
                        "Invalid business ID format.",
                        HttpStatusCode.BadRequest
                    )
                );
            }
            const biz = await models.business
                .findById(businessId)
                .select("owner");
            if (!biz) {
                return next(
                    new CustomError(
                        "Business not found.",
                        HttpStatusCode.NotFound
                    )
                );
            }
            if (biz.owner.toString() !== userId) {
                return next(
                    new CustomError(
                        "Access denied to this business.",
                        HttpStatusCode.Forbidden
                    )
                );
            }
            businessIds = [new Types.ObjectId(businessId)];
        } else {
            const ownedBusinesses = await models.business
                .find({ owner: new Types.ObjectId(userId) })
                .select("_id");
            businessIds = ownedBusinesses.map(
                (b: any) => new Types.ObjectId(b._id)
            );
            if (businessIds.length === 0) {
                // No hay negocios -> no hay chats
                res.status(HttpStatusCode.Ok).send({
                    message: "Chats fetched successfully",
                    pagination: {
                        page,
                        limit,
                        total: 0,
                        hasMore: false,
                    },
                    data: [],
                });
                return;
            }
        }

        // Construir filtro
        const filter: Record<string, any> = {
            business: { $in: businessIds },
        };
        if (status) filter.status = status;
        if (source) filter.source = source;
        if (purpose) filter.purpose = purpose;
        if (q && q.trim()) {
            filter["messages.content"] = { $regex: q.trim(), $options: "i" };
        }

        // Consulta y conteo
        const [chats, total] = await Promise.all([
            models.chat
                .find(filter)
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .lean(),
            models.chat.countDocuments(filter),
        ]);

        const items = chats.map((c: any) => {
            const lastMsg = Array.isArray(c.messages) && c.messages.length
                ? c.messages[c.messages.length - 1]
                : null;
            return {
                id: c._id,
                business: c.business,
                source: c.source,
                purpose: c.purpose,
                status: c.status,
                aiProvider: c.aiProvider,
                aiModel: c.aiModel,
                participants: c.participants,
                integration: c.integration,
                lastMessageAt: c.lastMessageAt,
                lastMessage: lastMsg
                    ? {
                          role: lastMsg.role,
                          content:
                              typeof lastMsg.content === "string"
                                  ? lastMsg.content
                                        .toString()
                                        .slice(0, 180)
                                  : "",
                          createdAt: lastMsg.createdAt,
                      }
                    : null,
                createdAt: c.createdAt,
                updatedAt: c.updatedAt,
            };
        });

        res.status(HttpStatusCode.Ok).send({
            message: "Chats fetched successfully",
            pagination: {
                page,
                limit,
                total,
                hasMore: skip + items.length < total,
            },
            filters: {
                businessId: businessId || null,
                status: status || null,
                source: source || null,
                purpose: purpose || null,
                q: q || null,
                sort: sortParam,
            },
            data: items,
        });
    } catch (error) {
        console.error("Error fetching chats:", error);
        next(error);
    }
}

/**
 * Obtiene una conversación específica (incluyendo sus mensajes).
 * Soporta limitar el número de mensajes devueltos usando `limit` (últimos N).
 */
export async function getChatByIdController(
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const { id } = req.params;

        let chat;
        try {
            chat = await getAuthorizedChat(id, req.user?.id);
        } catch (err: any) {
            switch (err?.message) {
                case "INVALID_ID":
                    return next(
                        new CustomError(
                            "Invalid chat ID format.",
                            HttpStatusCode.BadRequest
                        )
                    );
                case "NOT_FOUND":
                    return next(
                        new CustomError(
                            "Chat not found.",
                            HttpStatusCode.NotFound
                        )
                    );
                case "UNAUTHORIZED":
                    return next(
                        new CustomError(
                            "User authentication required.",
                            HttpStatusCode.Unauthorized
                        )
                    );
                case "FORBIDDEN":
                    return next(
                        new CustomError(
                            "Access denied to this chat.",
                            HttpStatusCode.Forbidden
                        )
                    );
                default:
                    throw err;
            }
        }

        const limit = Math.max(parseInt(String(req.query.limit || 50), 10) || 50, 1);
        const totalMessages = chat.messages?.length || 0;
        const messages = totalMessages > 0
            ? (chat.messages as any[]).slice(-limit)
            : [];

        res.status(HttpStatusCode.Ok).send({
            message: "Chat fetched successfully",
            data: {
                id: chat._id,
                business: chat.business,
                participants: chat.participants,
                integration: chat.integration,
                source: chat.source,
                purpose: chat.purpose,
                aiProvider: chat.aiProvider,
                aiModel: chat.aiModel,
                systemPrompt: chat.systemPrompt,
                status: chat.status,
                usage: chat.usage,
                metadata: chat.metadata,
                lastMessageAt: chat.lastMessageAt,
                createdAt: chat.createdAt,
                updatedAt: chat.updatedAt,
                messages,
                messagesMeta: {
                    returned: messages.length,
                    total: totalMessages,
                    showingLast: Math.min(limit, totalMessages),
                },
            },
        });
    } catch (error) {
        console.error("Error fetching chat by id:", error);
        next(error);
    }
}

export async function addUserMessageController(
	req: AuthRequest,
	res: Response,
	next: NextFunction
): Promise<void> {
	try {
		const { id } = req.params;
		const { content, attachments } = req.body;

		if (!content || typeof content !== "string") {
			return next(
				new CustomError(
					"Message content is required",
					HttpStatusCode.BadRequest
				)
			);
		}

		let chat;
		try {
			chat = await getAuthorizedChat(id, req.user?.id);
		} catch (err: any) {
			switch (err?.message) {
				case "INVALID_ID":
					return next(
						new CustomError(
							"Invalid chat ID format.",
							HttpStatusCode.BadRequest
						)
					);
				case "NOT_FOUND":
					return next(
						new CustomError(
							"Chat not found.",
							HttpStatusCode.NotFound
						)
					);
				case "UNAUTHORIZED":
					return next(
						new CustomError(
							"User authentication required.",
							HttpStatusCode.Unauthorized
						)
					);
				case "FORBIDDEN":
					return next(
						new CustomError(
							"Access denied to this chat.",
							HttpStatusCode.Forbidden
						)
					);
				default:
					throw err;
			}
		}

		chat.addMessage({
			role: "user",
			content: content.trim(),
			attachments,
			createdBy: req.user?.id
				? new Types.ObjectId(req.user.id)
				: undefined,
		});

		await chat.save();

		res.status(HttpStatusCode.Created).send({
			message: "Message added successfully",
			chatId: chat._id,
			lastMessageAt: chat.lastMessageAt,
		});
	} catch (error) {
		console.error("Error adding user message:", error);
		next(error);
	}
}

export async function generateAssistantReplyController(
	req: AuthRequest,
	res: Response,
	next: NextFunction
): Promise<void> {
	try {
		const { id } = req.params;
		const { temperature, maxTokens, model } = req.body;

		let chat;
		try {
			chat = await getAuthorizedChat(id, req.user?.id);
		} catch (err: any) {
			switch (err?.message) {
				case "INVALID_ID":
					return next(
						new CustomError(
							"Invalid chat ID format.",
							HttpStatusCode.BadRequest
						)
					);
				case "NOT_FOUND":
					return next(
						new CustomError(
							"Chat not found.",
							HttpStatusCode.NotFound
						)
					);
				case "UNAUTHORIZED":
					return next(
						new CustomError(
							"User authentication required.",
							HttpStatusCode.Unauthorized
						)
					);
				case "FORBIDDEN":
					return next(
						new CustomError(
							"Access denied to this chat.",
							HttpStatusCode.Forbidden
						)
					);
				default:
					throw err;
			}
		}

		const { reply, usage, lastMessageAt } =
			await chatService.generateAndSaveReply(chat, {
				temperature,
				maxTokens,
				model,
			});

		res.status(HttpStatusCode.Ok).send({
			message: "Assistant reply generated successfully",
			chatId: chat._id,
			reply: reply,
			usage: usage,
			lastMessageAt: lastMessageAt,
		});
	} catch (error) {
		console.error("Error generating assistant reply:", error);
		next(error);
	}
}
