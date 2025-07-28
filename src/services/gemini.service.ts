import { GoogleGenerativeAI } from '@google/generative-ai';

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY no está configurada en las variables de entorno');
    }

    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
  }

  /**
   * Genera un BrandScript completo basado en las respuestas del usuario
   */
  async generateBrandScript(answers: {
    companyName: string;
    productsServices: string;
    targetAudience: string;
    mainProblem: string;
    solution: string;
    uniqueCharacteristics: string;
    authority: string;
    steps: string;
  }): Promise<string> {
    const prompt = this.buildBrandScriptPrompt(answers);

    try {
      const result = await this.model.generateContent({
        contents: [{
          role: 'user',
          parts: [{
            text: `Eres un experto en marketing y comunicación que ayuda a crear BrandScripts efectivos siguiendo el framework de StoryBrand de Donald Miller. Generas contenido claro, persuasivo y orientado a resultados en español.\n\n${prompt}`
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2000,
        }
      });

      const response = await result.response;
      return response.text() || 'Error al generar el BrandScript';
    } catch (error) {
      console.error('Error al generar BrandScript con Gemini:', error);
      throw new Error('Error al generar el BrandScript');
    }
  }

  /**
   * Genera contenido específico de marketing basado en el BrandScript
   */
  async generateMarketingContent(brandScript: string, contentType: 'email' | 'landing' | 'social' | 'elevator'): Promise<string> {
    const prompts = {
      email: 'Crea un email de marketing persuasivo basado en este BrandScript:',
      landing: 'Crea el copy para una landing page efectiva basada en este BrandScript:',
      social: 'Crea 3 posts para redes sociales basados en este BrandScript:',
      elevator: 'Crea un elevator pitch de 30 segundos basado en este BrandScript:'
    };

    try {
      const result = await this.model.generateContent({
        contents: [{
          role: 'user',
          parts: [{
            text: `Eres un copywriter experto que crea contenido de marketing efectivo en español siguiendo los principios de StoryBrand.\n\n${prompts[contentType]}\n\n${brandScript}`
          }]
        }],
        generationConfig: {
          temperature: 0.8,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1500,
        }
      });

      const response = await result.response;
      return response.text() || 'Error al generar contenido';
    } catch (error) {
      console.error('Error al generar contenido de marketing:', error);
      throw new Error('Error al generar el contenido de marketing');
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
      const result = await this.model.generateContent({
        contents: [{
          role: 'user',
          parts: [{
            text: `Eres un consultor experto en StoryBrand que analiza y mejora BrandScripts para maximizar su efectividad.\n\n${prompt}`
          }]
        }],
        generationConfig: {
          temperature: 0.6,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2000,
        }
      });

      const response = await result.response;
      return response.text() || 'Error al analizar el BrandScript';
    } catch (error) {
      console.error('Error al analizar BrandScript:', error);
      throw new Error('Error al analizar el BrandScript');
    }
  }

  private buildBrandScriptPrompt(answers: any): string {
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
- Pasos para comprar/usar: ${answers.steps}

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
}

export default new GeminiService();