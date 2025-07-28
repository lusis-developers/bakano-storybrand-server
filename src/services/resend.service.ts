import "dotenv/config";

import CustomError from "../errors/customError.error";
import { Resend } from "resend";
import { generateEmailToVerifiedUser } from "../emails/notifications/generateEmailToVerifiedUser";

class ResendEmail {
  private resend: Resend;

  private internalSpecialists: string[] = [
    "dreyes@bakano.ec",
    "dquimi@bakano.ec",
    "lreyes@bakano.ec",
  ];

  constructor() {
    const RESEND_KEY = process.env.RESEND_KEY;
    if (!RESEND_KEY) {
      throw new Error("Resend API key is missing");
    }
    this.resend = new Resend(RESEND_KEY);
  }

  public async sendWelcomeVerificationEmail(
    email: string,
    name: string,
    verificationToken: string
  ): Promise<void> {
    try {
      const verificationLink = `${process.env.FRONTEND_URL}/verify/${verificationToken}`;
      console.log("Verification link: ", verificationLink);
      const content = await generateEmailToVerifiedUser(email, name, verificationLink);

      const { data, error } = await this.resend.emails.send({
        to: email,
        from: "bakano@bakano.ec",
        html: content,
        subject: "¡Bienvenido a Bakano! Verifica tu cuenta para comenzar 🚀",
      });

      if (error) {
        throw new CustomError("Problem sending email from resend", 400, error);
      }
    } catch (error) {
      throw new Error(`Problem sending welcome verification email: ${error}`);
    }
  }

}

export default ResendEmail;