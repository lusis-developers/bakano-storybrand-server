import type { MessageRole } from "../models/chat.model";
import openAIService from "./openai.service";
import geminiService from "./gemini.service";

type AIProvider = "openai" | "gemini";

// Una interfaz estandarizada para la respuesta de CUALQUIER proveedor
interface AIResult {
	content: string;
	providerUsed: AIProvider;
	modelUsed: string;
	usage?: {
		promptTokens?: number;
		completionTokens?: number;
		totalTokens?: number;
	};
}

// Interfaz para la configuración
interface AIConfig {
	temperature: number;
	maxTokens: number;
	model?: string;
	primaryProvider: AIProvider;
}

export class AIChatService {
	/**
	 * Genera una respuesta de chat implementando failover.
	 * Intenta con el proveedor primario, y si falla, con el secundario.
	 */
	async generateChatCompletion(
		systemPrompt: string,
		context: Array<{ role: MessageRole; content: string }>,
		config: AIConfig
	): Promise<AIResult> {
		const { primaryProvider, temperature, maxTokens, model } = config;

		// Define el orden de intento (failover)
		const attemptOrder: AIProvider[] =
			primaryProvider === "openai"
				? ["openai", "gemini"]
				: ["gemini", "openai"];

		let lastError: Error | null = null;

		for (const provider of attemptOrder) {
			try {
				if (provider === "openai") {
					console.log("[AIChatService] 🤖 Intentando con OpenAI...");
					const chosenModel = model || "gpt-4o";
					const { reply, usage } =
						await openAIService.generateChatReply(
							systemPrompt,
							context,
							{ temperature, maxTokens, model: chosenModel }
						);

					if (!reply)
						throw new Error("OpenAI devolvió una respuesta vacía.");

					return {
						content: reply,
						providerUsed: "openai",
						modelUsed: chosenModel,
						usage: {
							promptTokens: usage?.prompt_tokens,
							completionTokens: usage?.completion_tokens,
							totalTokens: usage?.total_tokens,
						},
					};
				} else {
				// Gemini

				console.log("[AIChatService] ✨ Intentando con Gemini...");
				// Usar modelos seguros por defecto para el SDK actual
				const chosenModel = model || "gemini-2.0-flash";
					const { reply, usage } =
						await geminiService.generateChatReply(
							systemPrompt,
							context,
							{
								temperature,
								maxOutputTokens: maxTokens,
								model: chosenModel,
							}
						);

					if (!reply)
						throw new Error("Gemini devolvió una respuesta vacía.");

					return {
						content: reply,
						providerUsed: "gemini",
						modelUsed: chosenModel,
						usage: usage, // 'usage' de Gemini ya tiene el formato correcto (o es undefined)
					};
				}
			} catch (error: any) {
				console.warn(
					`[AIChatService] ⚠️ Falló el proveedor ${provider}: ${error.message}`
				);
				lastError = error;
				// El bucle continuará con el siguiente proveedor (failover)
			}
		}

		// Si el bucle termina, significa que todos los proveedores fallaron.
		console.error(
			"[AIChatService] ❌ Todos los proveedores de IA fallaron."
		);
		throw lastError || new Error("Todos los proveedores de IA fallaron.");
	}
}

export const aiChatService = new AIChatService();
