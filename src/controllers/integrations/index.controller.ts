import { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import models from "../../models";
import { facebookService } from "../../services/facebook.service";
import { instagramService } from "../../services/instagram.service";

export async function getIntegrationsController(
	req: Request,
	res: Response,
	next: NextFunction
) {
	try {
		const { businessId } = req.params;
		if (!businessId || !Types.ObjectId.isValid(businessId)) {
			return res.status(400).send({ message: "businessId inválido" });
		}

    // Seleccionamos explícitamente el accessToken para Instagram (oculto por defecto)
    const rawIntegrations = await models.integration
      .find({ business: businessId })
      .select('+config.accessToken')
      .sort({ createdAt: -1 })
      .lean();

    // Enriquecer con foto de perfil según el tipo
    const enriched = await Promise.all(
      rawIntegrations.map(async (intg: any) => {
        let picture: any = undefined;
        let followers: number | undefined = undefined;

        try {
          if (intg.type === 'facebook' && intg?.metadata?.pageId) {
            const pageId = String(intg.metadata.pageId);
            picture = {
              url: facebookService.getPageProfilePictureRedirectUrl(pageId),
              small: facebookService.getPageProfilePictureRedirectUrl(pageId, { type: 'small' }),
              normal: facebookService.getPageProfilePictureRedirectUrl(pageId, { type: 'normal' }),
              large: facebookService.getPageProfilePictureRedirectUrl(pageId, { type: 'large' }),
              size150: facebookService.getPageProfilePictureRedirectUrl(pageId, { width: 150, height: 150 }),
            };
            // Obtener followers_count (o fan_count) si tenemos token de página
            if (intg?.config?.accessToken) {
              const pageAccessToken = String(intg.config.accessToken);
              const stats = await facebookService.getPageFollowerStats(pageAccessToken, pageId);
              followers = stats.followers_count ?? stats.fan_count ?? undefined;
            }
          } else if (intg.type === 'instagram' && intg?.metadata?.instagramAccountId && intg?.config?.accessToken) {
            const igUserId = String(intg.metadata.instagramAccountId);
            const accessToken = String(intg.config.accessToken);
            // Obtenemos una URL fresca para la foto de perfil IG
            const profile = await instagramService.getUserProfile(igUserId, accessToken);
            picture = {
              url: profile.profile_picture_url,
            };
            followers = profile.followers_count ?? undefined;
          }
        } catch (e) {
          // No romper la respuesta si falla; simplemente omitimos picture
          console.warn('[getIntegrationsController] No se pudo enriquecer picture para integración', intg?._id, (e as Error).message);
        }

        // Evitar exponer el accessToken en la respuesta
        if (intg?.config?.accessToken) {
          delete intg.config.accessToken;
        }

        return { ...intg, picture, followers };
      })
    );

    return res.status(200).send({ count: enriched.length, data: enriched });
	} catch (error) {
		console.error("Error al obtener integraciones:", error);
		next(error);
	}
}
