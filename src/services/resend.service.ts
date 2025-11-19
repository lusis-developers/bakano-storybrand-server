import "dotenv/config";

import CustomError from "../errors/customError.error";
import { Resend } from "resend";
import { generateEmailToVerifiedUser } from "../emails/notifications/generateEmailToVerifiedUser";
import { generateTeamInviteEmail } from "../emails/notifications/teamInvite.email";
import { generateTeamRoleUpdatedEmail } from "../emails/notifications/teamRoleUpdated.email";
import { generateTeamRevokedEmail } from "../emails/notifications/teamRevoked.email";
import { generateSetupPasswordEmail } from "../emails/notifications/setupPassword.email";
import { generateTeamAcceptedEmail } from "../emails/notifications/teamAccepted.email";

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

  public async sendTeamInviteEmail(
    to: string,
    inviteeName: string,
    businessName: string,
    inviterName: string,
    acceptLink: string
  ): Promise<void> {
    const html = await generateTeamInviteEmail(inviteeName, businessName, inviterName, acceptLink);
    const { error } = await this.resend.emails.send({
      to,
      from: "bakano@bakano.ec",
      html,
      subject: `Invitation to collaborate on ${businessName}`,
    });
    if (error) {
      throw new CustomError("Problem sending invitation email", 400, error);
    }
  }

  public async sendTeamRoleUpdatedEmail(
    to: string,
    name: string,
    businessName: string,
    role: string
  ): Promise<void> {
    const html = await generateTeamRoleUpdatedEmail(name, businessName, role);
    const { error } = await this.resend.emails.send({
      to,
      from: "bakano@bakano.ec",
      html,
      subject: `Your role in ${businessName} was updated`,
    });
    if (error) {
      throw new CustomError("Problem sending role updated email", 400, error);
    }
  }

  public async sendTeamRevokedEmail(
    to: string,
    name: string,
    businessName: string
  ): Promise<void> {
    const html = await generateTeamRevokedEmail(name, businessName);
    const { error } = await this.resend.emails.send({
      to,
      from: "bakano@bakano.ec",
      html,
      subject: `Your access to ${businessName} was revoked`,
    });
    if (error) {
      throw new CustomError("Problem sending revoked email", 400, error);
    }
  }

  public async sendSetupPasswordEmail(
    to: string,
    name: string,
    token: string
  ): Promise<void> {
    const setupLink = `${process.env.FRONTEND_URL}/create-password/${token}`;
    const html = await generateSetupPasswordEmail(name, setupLink);
    const { error } = await this.resend.emails.send({
      to,
      from: "bakano@bakano.ec",
      html,
      subject: `Set your password to access Bakano`,
    });
    if (error) {
      throw new CustomError("Problem sending setup password email", 400, error);
    }
  }

  public async sendTeamAcceptedEmail(
    to: string,
    ownerName: string,
    memberName: string,
    businessName: string,
    businessId: string
  ): Promise<void> {
    const dashboardLink = `${process.env.FRONTEND_URL}/business/${businessId}/team`;
    const html = await generateTeamAcceptedEmail(ownerName, memberName, businessName, dashboardLink);
    const { error } = await this.resend.emails.send({
      to,
      from: "bakano@bakano.ec",
      html,
      subject: `${memberName} joined ${businessName}`,
    });
    if (error) {
      throw new CustomError("Problem sending invitation accepted email", 400, error);
    }
  }
}

export default ResendEmail;