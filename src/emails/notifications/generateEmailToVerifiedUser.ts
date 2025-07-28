export async function generateEmailToVerifiedUser(
  email: string,
  name: string,
  verificationLink: string
): Promise<string> {
  const HtmlEmail = `
  <html>
    <body style="margin:0; padding:0; font-family: Arial, sans-serif; background-color: #ededed; color: #191423;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #ededed;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05); margin-top: 40px;">
              <!-- LOGO -->
              <tr style="background-color: #191423;">
                <td align="center" style="padding: 30px;">
                  <img src="https://res.cloudinary.com/dpjzfua3n/image/upload/v1747532776/bakano-light_xvxdmc.png" alt="Bakano Logo" width="150" style="display: block;"/>
                </td>
              </tr>

              <!-- HEADER -->
              <tr>
                <td align="center" style="padding: 20px 40px 0 40px;">
                  <h1 style="margin: 0; font-size: 26px; color: #e6285c;">¡Bienvenido a Bakano! 🎉</h1>
                </td>
              </tr>

              <!-- CONTENT -->
              <tr>
                <td style="padding: 20px 40px 40px 40px;">
                  <p style="font-size: 16px; color: #191423;">Hola <strong>${name}</strong>,</p>
                  <p style="font-size: 16px; color: #191423;">
                    ¡Tu cuenta ha sido creada exitosamente! ✅ Estamos emocionados de tenerte como parte de la familia Bakano.
                  </p>
                  <p style="font-size: 16px; color: #191423;">
                    Para completar el proceso y acceder a todas las funcionalidades, necesitas verificar tu cuenta de correo electrónico.
                  </p>
                  
                  <!-- VERIFICATION BUTTON -->
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${verificationLink}" style="background-color: #e6285c; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">Verificar mi cuenta</a>
                  </div>
                  
                  <p style="font-size: 16px; color: #191423;">
                    Una vez verificada tu cuenta, podrás acceder a todas nuestras herramientas y comenzar a crear contenido increíble para tu marca.
                  </p>
                  <p style="font-size: 16px; color: #191423;">
                    Si tienes alguna pregunta o necesitas ayuda, no dudes en contactarnos. Nuestro equipo está aquí para apoyarte.
                  </p>
                  <p style="font-size: 16px; color: #85529c; font-style: italic;">
                    ¡Estamos listos para crear algo extraordinario juntos!
                  </p>
                  <p style="font-size: 16px; color: #85529c; font-style: italic;">— Bakano Team 💥</p>
                </td>
              </tr>

              <!-- FOOTER -->
              <tr style="background-color: #191423;">
                <td align="center" style="padding: 30px; color: #f5f5f5;">
                  <p style="margin: 0; font-size: 14px;">¿Tienes preguntas? Escríbenos a <a href="mailto:dquimi@bakano.ec" style="color: #e6285c; text-decoration: none;">dquimi@bakano.ec</a></p>
                  <p style="margin: 20px 0 10px 0; font-size: 14px;">Síguenos en nuestras redes:</p>
                  <p style="margin: 0;">
                    <a href="https://www.instagram.com/bakano.ec/" style="margin: 0 10px;"><img src="https://cdn-icons-png.flaticon.com/512/1384/1384063.png" alt="Instagram" width="24"/></a>
                    <a href="https://www.facebook.com/bakano.ec" style="margin: 0 10px;"><img src="https://cdn-icons-png.flaticon.com/512/733/733547.png" alt="Facebook" width="24"/></a>
                  </p>
                  <p style="margin-top: 20px; font-size: 12px; color: #bbbbbb;">© ${new Date().getFullYear()} Bakano Agency. Todos los derechos reservados.</p>
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