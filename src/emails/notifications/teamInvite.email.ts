import { Colors } from "../../enums/colorVariables.enum";

export async function generateTeamInviteEmail(
  inviteeName: string,
  businessName: string,
  inviterName: string,
  acceptLink: string
): Promise<string> {
  const HtmlEmail = `
  <html>
    <body style="margin:0; padding:0; font-family: Arial, sans-serif; background-color: ${Colors.BAKANO_LIGHT}; color: ${Colors.BAKANO_DARK};">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${Colors.BAKANO_LIGHT};">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: ${Colors.WHITE}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05); margin-top: 40px;">
              <tr style="background-color: ${Colors.BAKANO_DARK};">
                <td align="center" style="padding: 30px;">
                  <img src="https://res.cloudinary.com/dpjzfua3n/image/upload/v1747532776/bakano-light_xvxdmc.png" alt="Bakano Logo" width="150" style="display: block;"/>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding: 20px 40px 0 40px;">
                  <h1 style="margin: 0; font-size: 24px; color: ${Colors.BAKANO_PINK};">Has sido invitado</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 20px 40px 40px 40px;">
                  <p style="font-size: 16px; color: ${Colors.BAKANO_DARK};">Hola <strong>${inviteeName}</strong>,</p>
                  <p style="font-size: 16px; color: ${Colors.BAKANO_DARK};">${inviterName} te invitó a colaborar en <strong>${businessName}</strong>.</p>
                  <p style="font-size: 16px; color: ${Colors.BAKANO_DARK};">Por favor acepta la invitación para unirte al equipo.</p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${acceptLink}" style="background-color: ${Colors.BAKANO_PINK}; color: ${Colors.WHITE}; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">Aceptar invitación</a>
                  </div>
                  <p style="font-size: 14px; color: ${Colors.TEXT_PLACEHOLDER};">Si el botón no funciona, utiliza este enlace: ${acceptLink}</p>
                </td>
              </tr>
              <tr style="background-color: ${Colors.BAKANO_DARK};">
                <td align="center" style="padding: 20px; color: ${Colors.TEXT_LIGHT};">
                  <p style="margin: 0; font-size: 12px;">© ${new Date().getFullYear()} Bakano Agency.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;
  return HtmlEmail;
}