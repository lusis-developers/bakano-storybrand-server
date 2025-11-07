// Declaración mínima para evitar errores de tipos al usar '@google/genai'.
// Si más adelante deseas tipos estrictos, podemos ampliar estas definiciones
// según la API pública del SDK.

declare module "@google/genai" {
  export class GoogleGenAI {
    constructor(options?: { apiKey?: string });
    models: {
      generateContent: (args: {
        model: string;
        contents: any;
      }) => Promise<{ text: string } | any>;
    };
  }
}