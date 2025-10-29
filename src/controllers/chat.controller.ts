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
			systemPrompt:
				systemPrompt?.trim() ||
				"Eres un asistente de marketing que analiza métricas y contenido de IG/FB y recomienda acciones claras y accionables para el usuario.",
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
