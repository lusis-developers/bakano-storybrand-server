import { Schema, model, Document, Types } from "mongoose";

export type ChatSource = "internal" | "facebook" | "instagram";
export type ChatPurpose = "analytics" | "content" | "support" | "general";
export type ChatStatus = "active" | "archived" | "closed";
export type MessageRole = "user" | "assistant" | "system" | "external";
export type AIProvider = "openai" | "gemini";

export interface IAttachment {
	type: "post" | "image" | "metric" | "file";
	platform?: "facebook" | "instagram";
	externalId?: string; // ID del post/activo en la plataforma externa
	contentId?: Types.ObjectId; // Referencia opcional al modelo Content local
	url?: string;
	title?: string;
	previewText?: string;
	metrics?: Record<string, number>; // Ej: { impressions: 1234, likes: 56 }
}

export interface IMessage {
	role: MessageRole;
	content: string;
	attachments?: IAttachment[];
	createdBy?: Types.ObjectId; // Usuario humano que envió el mensaje (si aplica)
	ai?: {
		provider?: AIProvider;
		model?: string;
		promptTokens?: number;
		completionTokens?: number;
		totalTokens?: number;
		reasoning?: string;
	};
	error?: {
		message: string;
		code?: string;
	};
	createdAt: Date;
}

export interface IChatUsage {
	promptTokens?: number;
	completionTokens?: number;
	totalTokens?: number;
}

export interface IChat extends Document {
	business: Types.ObjectId;
	participants: Types.ObjectId[]; // Usuarios humanos involucrados
	integration?: Types.ObjectId; // Cuenta/página integrada (Meta/Instagram/Facebook)
	source: ChatSource; // Canal principal de la conversación
	purpose: ChatPurpose; // ¿Para qué se usa este chat?
	aiProvider: AIProvider; // Proveedor principal de IA
	aiModel?: string; // Modelo preferido para respuestas
	systemPrompt?: string; // Prompt base/sistema para orientar respuestas
	aiSessionId?: string; // ID de sesión/hilo si el proveedor lo gestiona
	status: ChatStatus;
	messages: IMessage[];
	lastMessageAt?: Date;
	usage?: IChatUsage;
	metadata?: Record<string, any>; // flex para contexto adicional
	createdAt: Date;
	updatedAt: Date;
	// Métodos
	addMessage(message: Omit<IMessage, "createdAt">): void;
	getContextForAI(
		limit?: number
	): Array<{ role: MessageRole; content: string }>;
}

// --- SUBSCHEMAS ---

const attachmentSchema = new Schema<IAttachment>(
	{
		type: {
			type: String,
			enum: ["post", "image", "metric", "file"],
			required: true,
		},
		platform: {
			type: String,
			enum: ["facebook", "instagram"],
		},
		externalId: { type: String, trim: true },
		contentId: { type: Schema.Types.ObjectId, ref: "Content" },
		url: { type: String, trim: true },
		title: { type: String, trim: true },
		previewText: { type: String, trim: true },
		metrics: { type: Schema.Types.Mixed },
	},
	{ _id: false }
);

const messageSchema = new Schema<IMessage>(
	{
		role: {
			type: String,
			enum: ["user", "assistant", "system", "external"],
			required: true,
			index: true,
		},
		content: {
			type: String,
			required: true,
			trim: true,
		},
		attachments: [attachmentSchema],
		createdBy: {
			type: Schema.Types.ObjectId,
			ref: "User",
			index: true,
		},
		ai: {
			provider: { type: String, enum: ["openai", "gemini"] },
			model: { type: String, trim: true },
			promptTokens: { type: Number, min: 0 },
			completionTokens: { type: Number, min: 0 },
			totalTokens: { type: Number, min: 0 },
			reasoning: { type: String, trim: true },
		},
		error: {
			message: { type: String, trim: true },
			code: { type: String, trim: true },
		},
		createdAt: {
			type: Date,
			default: Date.now,
			index: true,
		},
	},
	{ _id: false }
);

// --- MAIN SCHEMA ---

const chatSchema = new Schema<IChat>(
	{
		business: {
			type: Schema.Types.ObjectId,
			ref: "Business",
			required: true,
			index: true,
		},
		participants: [
			{
				type: Schema.Types.ObjectId,
				ref: "User",
				index: true,
			},
		],
		integration: {
			type: Schema.Types.ObjectId,
			ref: "Integration",
			index: true,
		},
		source: {
			type: String,
			enum: ["internal", "facebook", "instagram"],
			default: "internal",
			index: true,
		},
		purpose: {
			type: String,
			enum: ["analytics", "content", "support", "general"],
			default: "general",
			index: true,
		},
		aiProvider: {
			type: String,
			enum: ["openai", "gemini"],
			default: "gemini",
			index: true,
		},
		aiModel: { type: String, trim: true },
		systemPrompt: { type: String, trim: true },
		aiSessionId: { type: String, trim: true },
		status: {
			type: String,
			enum: ["active", "archived", "closed"],
			default: "active",
			index: true,
		},
		messages: {
			type: [messageSchema],
			default: [],
		},
		lastMessageAt: { type: Date, index: true },
		usage: {
			promptTokens: { type: Number, min: 0 },
			completionTokens: { type: Number, min: 0 },
			totalTokens: { type: Number, min: 0 },
		},
		metadata: { type: Schema.Types.Mixed, default: {} },
	},
	{
		timestamps: true,
		versionKey: false,
	}
);

// --- INDEXES ---
chatSchema.index({ business: 1, status: 1, lastMessageAt: -1 });
chatSchema.index({ integration: 1, source: 1 });
chatSchema.index({ "messages.role": 1 });

// --- METHODS ---
chatSchema.methods.addMessage = function (
	message: Omit<IMessage, "createdAt">
): void {
	const msg: IMessage = { ...message, createdAt: new Date() } as IMessage;
	this.messages.push(msg);

	// Actualizar lastMessageAt
	this.lastMessageAt = msg.createdAt;

	// Agregar uso de tokens a nivel de conversación si viene incluido
	if (msg.ai?.totalTokens) {
		this.usage = this.usage || {};
		this.usage.totalTokens =
			(this.usage.totalTokens || 0) + (msg.ai.totalTokens || 0);
		this.usage.promptTokens =
			(this.usage.promptTokens || 0) + (msg.ai.promptTokens || 0);
		this.usage.completionTokens =
			(this.usage.completionTokens || 0) + (msg.ai.completionTokens || 0);
	}
};

chatSchema.methods.getContextForAI = function (
	limit: number = 20
): Array<{ role: MessageRole; content: string }> {
	const slice: IMessage[] = (this.messages as IMessage[]).slice(-limit);
	return slice.map((m: IMessage) => ({ role: m.role, content: m.content }));
};

// --- MIDDLEWARES ---
chatSchema.pre("save", function (next) {
	if (this.messages?.length) {
		const last = this.messages[this.messages.length - 1];
		this.lastMessageAt = last.createdAt;
	}
	next();
});

// --- EXPORTS ---
export const Chat = model<IChat>("Chat", chatSchema);

export default Chat;
