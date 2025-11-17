import { Colors } from "../../enums/colorVariables.enum";

export async function generateTeamRoleUpdatedEmail(
  name: string,
  businessName: string,
  newRole: string
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
                  <h1 style="margin: 0; font-size: 24px; color: ${Colors.BAKANO_PINK};">Tu rol ha sido actualizado</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 20px 40px 40px 40px;">
                  <p style="font-size: 16px; color: ${Colors.BAKANO_DARK};">Hola <strong>${name}</strong>,</p>
                  <p style="font-size: 16px; color: ${Colors.BAKANO_DARK};">Tu rol en <strong>${businessName}</strong> ahora es <strong>${newRole}</strong>.</p>
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