import OpenAI from 'openai';
import type { MessageRole } from '../models/chat.model';

export class OpenAIService {
  private client: OpenAI;

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY no está configurada en las variables de entorno');
    }

    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
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
      const completion = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'Eres un experto en marketing y comunicación que ayuda a crear BrandScripts efectivos siguiendo el framework de StoryBrand de Donald Miller. Generas contenido claro, persuasivo y orientado a resultados en español.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      });

      return completion.choices[0]?.message?.content || 'Error al generar el BrandScript';
    } catch (error) {
      console.error('Error al generar BrandScript con OpenAI:', error);
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
      const completion = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'Eres un copywriter experto que crea contenido de marketing efectivo en español siguiendo los principios de StoryBrand.'
          },
          {
            role: 'user',
            content: `${prompts[contentType]}\n\n${brandScript}`
          }
        ],
        temperature: 0.8,
        max_tokens: 1500
      });

      return completion.choices[0]?.message?.content || 'Error al generar contenido';
    } catch (error) {
      console.error('Error al generar contenido de marketing:', error);
      throw new Error('Error al generar el contenido de marketing');
    }
  }

  private buildBrandScriptPrompt(answers: any): string {
    return `
Crea un BrandScript completo y profesional en español siguiendo el framework de StoryBrand para la siguiente empresa:

**INFORMACIÓN DE LA EMPRESA:**
- Nombre: ${answers.companyName}
- Productos/Servicios: ${answers.productsServices}
- Audiencia objetivo: ${answers.targetAudience}
- Problema principal: ${answers.mainProblem}
- Solución: ${answers.solution}
- Características únicas: ${answers.uniqueCharacteristics}
- Autoridad/Credenciales: ${answers.authority}
- Pasos para comprar/usar: ${answers.steps}

**ESTRUCTURA REQUERIDA:**

1. **EL PERSONAJE (CLIENTE)**: Define claramente quién es el cliente ideal
2. **TIENE UN PROBLEMA**: Describe el problema externo, interno y filosófico
3. **Y SE ENCUENTRA CON UNA GUÍA**: Posiciona a la empresa como la guía experta
4. **QUE LE DA UN PLAN**: Presenta un plan claro de 3 pasos
5. **Y LO LLAMA A LA ACCIÓN**: Define llamadas a acción directas y de transición
6. **QUE TERMINA EN ÉXITO**: Describe la transformación positiva
7. **Y LE AYUDA A EVITAR EL FRACASO**: Muestra las consecuencias de no actuar

**FORMATO DE SALIDA:**
Genera un BrandScript estructurado, claro y persuasivo que pueda usarse inmediatamente para crear contenido de marketing efectivo. Incluye ejemplos específicos de copy para cada sección.
`;
  }

  async generateChatReply(
    systemPrompt: string,
    context: Array<{ role: MessageRole; content: string }>,
    // Nota: El parámetro se llama 'maxTokens', no 'maxOutputTokens'
    config: { temperature: number; maxTokens: number; model?: string }
    // Nota: El tipo de 'usage' es específico de OpenAI
  ): Promise<{ reply: string; usage?: OpenAI.CompletionUsage }> { 
    
    try {
      const chosenModel = config.model || 'gpt-4o';
      
      // Adaptar roles para OpenAI (solo acepta system, user, assistant)
      const messages = [
        { role: 'system', content: systemPrompt },
        ...context
          .filter(m => m.role === 'user' || m.role === 'assistant') // Filtra roles válidos
          .map((m) => ({ role: m.role, content: m.content })),
      ] as Array<{
        role: 'system' | 'user' | 'assistant';
        content: string;
      }>;

      // Usar el cliente y método correctos de OpenAI
      const completion = await this.client.chat.completions.create({
        model: chosenModel,
        messages: messages,
        temperature: config.temperature,
        max_tokens: config.maxTokens, // Usar el nombre de parámetro correcto
      });

      const reply = completion.choices[0]?.message?.content || '';
      
      // Devolver el objeto 'usage' completo que nos da OpenAI
      return { reply, usage: completion.usage }; 

    } catch (error) {
      console.error('Error al generar chat con OpenAI:', error);
      throw new Error('Error al generar respuesta de OpenAI');
    }
  }
}

export default new OpenAIService();