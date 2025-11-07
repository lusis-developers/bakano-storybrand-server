import { GoogleGenAI } from "@google/genai";
import type { MessageRole } from "../models/chat.model";

export class GeminiService {
    private ai: any;

    private getModelName(modelName?: string): string {
        // Modelos seguros para v1beta del SDK actual
        const safeModels = new Set([
            "gemini-2.0-flash",
            "gemini-2.0-flash-lite",
            "gemini-2.0-pro",
        ]);

        const requested = (modelName?.trim() || "gemini-2.0-flash").toLowerCase();
        const aliasMap: Record<string, string> = {
            // Aliases conocidos
            "gemini-1.5-flash": "gemini-2.0-flash", // redirigimos a familia 2.0 para evitar NOT_FOUND
            "gemini-1.5-pro": "gemini-2.0-pro",
            "gemini-2.5-flash": "gemini-2.0-flash", // algunos entornos no exponen 2.5 en v1beta
        };

        const mapped = aliasMap[requested] || requested;
        return safeModels.has(mapped) ? mapped : "gemini-2.0-flash";
    }

	constructor() {
		if (!process.env.GEMINI_API_KEY) {
			throw new Error(
				"GEMINI_API_KEY no está configurada en las variables de entorno"
			);
		}

		// Inicializa cliente del nuevo SDK
		this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
	}

    private async generateTextWithFallback(model: string, contents: string): Promise<string> {
        const primary = this.getModelName(model);
        const fallback1 = "gemini-2.0-flash";
        const fallback2 = "gemini-2.0-pro";

        // 1) Intento primario
        try {
            const response = await this.ai.models.generateContent({ model: primary, contents });
            return response?.text || "";
        } catch (error: any) {
            const status = error?.error?.status || error?.error?.code;
            const message = error?.error?.message || String(error);
            const notFound = status === "NOT_FOUND" || status === 404;
            const unsupported = /not supported/i.test(message || "");

            if (notFound || unsupported) {
                console.warn(
                    `Modelo no disponible (${primary}). Fallback a '${fallback1}'. Detalle: ${message}`
                );
                // 2) Primer fallback
                try {
                    const response = await this.ai.models.generateContent({ model: fallback1, contents });
                    return response?.text || "";
                } catch (error2: any) {
                    const status2 = error2?.error?.status || error2?.error?.code;
                    const message2 = error2?.error?.message || String(error2);
                    const notFound2 = status2 === "NOT_FOUND" || status2 === 404;
                    const unsupported2 = /not supported/i.test(message2 || "");
                    console.warn(
                        `Fallback '${fallback1}' también falló. Intentando '${fallback2}'. Detalle: ${message2}`
                    );
                    // 3) Segundo fallback
                    try {
                        const response = await this.ai.models.generateContent({ model: fallback2, contents });
                        return response?.text || "";
                    } catch (error3: any) {
                        console.error(
                            `Falló segundo fallback '${fallback2}'. Error final:`,
                            error3?.error || error3
                        );
                        // Propagamos error más informativo
                        throw new Error(
                            `Modelos no disponibles. Intentos: ${primary} -> ${fallback1} -> ${fallback2}. Último error: ${message2}`
                        );
                    }
                }
            }
            // Errores distintos (p.ej. permisos) se propagan
            throw error;
        }
    }

	/**
	 * Genera un BrandScript completo basado en las respuestas del usuario
	 */
	async generateBrandScript(
		answers: {
			companyName: string;
			productsServices: string;
			targetAudience: string;
			mainProblem: string;
			solution: string;
			uniqueCharacteristics: string;
			authority: string;
			steps: string;
		},
		onboardingContext?: any
	): Promise<string> {
		const prompt = this.buildBrandScriptPrompt(answers, onboardingContext);

		try {
			const text = await this.generateTextWithFallback(
				this.getModelName("gemini-2.5-flash"),
				`Eres un experto en marketing y comunicación que ayuda a crear BrandScripts efectivos siguiendo el framework de StoryBrand de Donald Miller. Generas contenido claro, persuasivo y orientado a resultados en español.\n\n${prompt}`
			);
			return text || "Error al generar el BrandScript";
		} catch (error) {
			console.error("Error al generar BrandScript con Gemini:", error);
			throw new Error("Error al generar el BrandScript");
		}
	}

	/**
	 * Genera contenido específico de marketing basado en el BrandScript
	 */
	async generateMarketingContent(
		brandScript: string,
		contentType: "email" | "landing" | "social" | "elevator"
	): Promise<string> {
		const prompts = {
			email: "Crea un email de marketing persuasivo basado en este BrandScript:",
			landing:
				"Crea el copy para una landing page efectiva basada en este BrandScript:",
			social: "Crea 3 posts para redes sociales basados en este BrandScript:",
			elevator:
				"Crea un elevator pitch de 30 segundos basado en este BrandScript:",
		};

		try {
			const text = await this.generateTextWithFallback(
				this.getModelName("gemini-2.5-flash"),
				`Eres un copywriter experto que crea contenido de marketing efectivo en español siguiendo los principios de StoryBrand.\n\n${prompts[contentType]}\n\n${brandScript}`
			);
			return text || "Error al generar contenido";
		} catch (error) {
			console.error("Error al generar contenido de marketing:", error);
			throw new Error("Error al generar el contenido de marketing");
		}
	}

	/**
	 * Analiza y mejora un BrandScript existente
	 */
	async analyzeBrandScript(brandScript: string): Promise<string> {
		const prompt = `
Analiza el siguiente BrandScript y proporciona recomendaciones específicas para mejorarlo:

${brandScript}

**CRITERIOS DE ANÁLISIS:**
1. Claridad del mensaje
2. Identificación del cliente ideal
3. Definición del problema
4. Posicionamiento como guía
5. Claridad del plan
6. Efectividad de las llamadas a acción
7. Descripción del éxito
8. Consecuencias del fracaso

**FORMATO DE RESPUESTA:**
- Fortalezas identificadas
- Áreas de mejora
- Recomendaciones específicas
- Versión mejorada de las secciones más débiles
`;

		try {
			const text = await this.generateTextWithFallback(
				this.getModelName("gemini-2.5-flash"),
				`Eres un consultor experto en StoryBrand que analiza y mejora BrandScripts para maximizar su efectividad.\n\n${prompt}`
			);
			return text || "Error al analizar el BrandScript";
		} catch (error) {
			console.error("Error al analizar BrandScript:", error);
			throw new Error("Error al analizar el BrandScript");
		}
	}

	private buildBrandScriptPrompt(
		answers: any,
		onboardingContext?: any
	): string {
		let contextSection = "";

		if (onboardingContext && onboardingContext.isComplete) {
			contextSection = `
**CONTEXTO DEL USUARIO:**
${onboardingContext.generateAIPrompt()}

Usa este contexto para personalizar el BrandScript según el perfil, objetivos y canales de marketing del usuario.
`;
		}

		return `
Crea un BrandScript siguiendo el framework de StoryBrand para la siguiente empresa.

**INFORMACIÓN DE LA EMPRESA:**
- Nombre: ${answers.companyName}
- Productos/Servicios: ${answers.productsServices}
- Audiencia objetivo: ${answers.targetAudience}
- Problema principal: ${answers.mainProblem}
- Solución: ${answers.solution}
- Características únicas: ${answers.uniqueCharacteristics}
- Autoridad/Credenciales: ${answers.authority}
- Pasos para comprar/usar: ${answers.steps}${contextSection}

**INSTRUCCIONES IMPORTANTES:**
1. Responde ÚNICAMENTE con un JSON válido
2. NO incluyas texto adicional, explicaciones o markdown
3. El JSON debe tener exactamente estos campos:

**FORMATO DE SALIDA (JSON):**
{
  "controllingIdea": "Una frase que resuma la propuesta de valor única",
  "characterWhatTheyWant": "Lo que quiere el cliente ideal",
  "problemExternal": "El problema externo que enfrentan",
  "problemInternal": "Cómo se sienten por dentro debido al problema",
  "problemPhilosophical": "Por qué está mal que tengan este problema",
  "guideEmpathy": "Cómo la empresa entiende su dolor",
  "guideCompetencyAndAuthority": "Por qué la empresa es la mejor opción",
  "planProcessSteps": ["Paso 1", "Paso 2", "Paso 3"],
  "callToActionDirect": "Llamada a acción principal",
  "callToActionTransitional": "Llamada a acción suave",
  "successResults": "Qué lograrán si actúan",
  "failureResults": "Qué pasará si no actúan",
  "transformationFrom": "De qué se transformarán",
  "transformationTo": "En qué se convertirán"
}

Responde SOLO con el JSON, sin texto adicional.
`;
	}
	/**
	 * Genera una respuesta de chat genérica
	 */
	async generateChatReply(
		systemPrompt: string,
		context: Array<{ role: MessageRole; content: string }>,
		config: { temperature: number; maxOutputTokens: number; model?: string }
	): Promise<{ reply: string; usage?: undefined }> {
		try {
			// Historial adaptado a texto plano
			const textPrompt = [
				`SYSTEM PROMPT: ${systemPrompt}`,
				...context.map((m) => `${m.role.toUpperCase()}: ${m.content}`),
			].join("\n\n");

			const reply = await this.generateTextWithFallback(
				this.getModelName(config.model || "gemini-2.5-flash"),
				textPrompt
			);
			return { reply: reply || "", usage: undefined };
		} catch (error) {
			console.error("Error al generar chat con Gemini:", error);
			throw new Error("Error al generar respuesta de Gemini");
		}
	}
}

export default new GeminiService();
