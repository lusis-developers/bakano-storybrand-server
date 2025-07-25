import { Response } from "express";

import axios from "axios";

class ErrorHandler {
  private slackWebHookUrl: string;

  constructor(slackWebhookUrl: string) {
    this.slackWebHookUrl = slackWebhookUrl;
  }

  handleHttpError(
    res: Response,
    message: string = "Something happened, but the team is working to solve it",
    code: number = 500,
    error: any,
  ): void {
    res.status(code).send({ message });

    this.notifySlack(error);
  }

  private async notifySlack(errorLog: any): Promise<void> {
    try {
      const errorMessage = `*Error en la API:*
      - *Mensaje*: ${errorLog.message || "Error desconocido"}
      - *Código de estado*: ${errorLog.status || 500}
      - *Pila de errores*: ${errorLog.details || "Sin stack trace disponible"}
      `;
      await axios.post(this.slackWebHookUrl, {
        text: errorMessage,
      });
    } catch (error) {
      console.error("Error al enviar notificacion en slack", error);
    }
  }
}

export default ErrorHandler;
