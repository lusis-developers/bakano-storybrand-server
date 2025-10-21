import { Request, Response, NextFunction } from "express";
import { HttpStatusCode } from "axios";
import CustomError from "../../errors/customError.error";
import { listLinkedInstagramAccounts, LinkedInstagramAccount } from "../../services/instagram-pages.service";
import { Integration } from "../../models/integration.model";
import { Business } from "../../models/business.model";
import { facebookService } from "../../services/facebook.service";
import { instagramService } from "../../services/instagram.service";

// Controlador: obtener páginas (con IG Business) que el usuario tiene acceso según su token de USUARIO (EAA...)
export async function instagramConnectController(req: Request, res: Response, next: NextFunction) {
  try {
    const { accessToken } = req.body || {};
    if (!accessToken) {
      return next(new CustomError(
        "Missing required parameter: accessToken",
        HttpStatusCode.BadRequest
      ));
    }

    const accounts: LinkedInstagramAccount[] = await listLinkedInstagramAccounts(accessToken);

    return res.status(HttpStatusCode.Ok).send({
      message: "Linked Instagram Business accounts fetched successfully",
      accounts,
      count: accounts.length
    });
  } catch (error) {
    next(error);
  }
}

// Controlador: guardar la página seleccionada con persistencia real
export async function instagramSavePageController(req: Request, res: Response, next: NextFunction) {
  try {
    const { business, pageId, pageAccessToken, instagramAccountId, pageName, accessToken } = req.body;
    if (!business || !pageId || !pageAccessToken || !instagramAccountId) {
      return next(new CustomError(
        "Missing required parameters: business, pageId, pageAccessToken, instagramAccountId",
        HttpStatusCode.BadRequest
      ));
    }

    // 1) Validar que el negocio exista
    const biz = await Business.findById(business);
    if (!biz) {
      return next(new CustomError("Business not found", HttpStatusCode.NotFound));
    }

    // 2) (Opcional) Intercambiar token de USUARIO corto por long-lived para futura renovación
    let longLivedUserToken: string | undefined;
    let userTokenExpiresAt: Date | undefined;
    if (accessToken && typeof accessToken === 'string') {
      try {
        const exchange = await facebookService.exchangeLongLivedUserAccessToken(accessToken);
        longLivedUserToken = exchange.access_token;
        userTokenExpiresAt = new Date(Date.now() + exchange.expires_in * 1000);
      } catch (e) {
        console.warn('[instagramSavePageController] No se pudo intercambiar el token de usuario por long-lived:', (e as Error).message);
      }
    }

    // 3) Obtener nombre de la página si no viene en el body
    let resolvedPageName = pageName as string | undefined;
    if (!resolvedPageName) {
      try {
        const details = await facebookService.getPageDetails(pageAccessToken, pageId);
        resolvedPageName = details.name;
      } catch (e) {
        console.warn('[instagramSavePageController] No se pudo obtener el nombre de la página, se usará el pageId:', pageId);
        resolvedPageName = `Page ${pageId}`;
      }
    }

    // 4) Guardar/Actualizar la integración con el PAGE token (finalización de conexión)
    let integration = await Integration.finalizeWithPageToken(business, pageId, resolvedPageName!, pageAccessToken);

    // Si no existía la integración previa (paso 1), creamos una nueva
    if (!integration) {
      integration = await Integration.create({
        name: `Instagram (via Meta): ${resolvedPageName}`,
        description: 'Instagram Business (via Meta)',
        type: 'meta',
        business,
        config: {
          accessToken: pageAccessToken,
          tokenExpiresAt: null,
        },
        isActive: true,
        isConnected: true,
        metadata: {
          pageId,
          pageName: resolvedPageName,
          platform: 'instagram',
          status: 'connected',
        },
      });
    }

    // 5) Actualizar metadata adicional: instagramAccountId y, si existe, token de usuario long-lived
    const metadataPatch: Record<string, any> = {
      'metadata.instagramAccountId': instagramAccountId,
      'metadata.platform': 'instagram',
    };
    if (longLivedUserToken) {
      metadataPatch['metadata.userAccessToken'] = longLivedUserToken;
      metadataPatch['metadata.userTokenExpiresAt'] = userTokenExpiresAt;
    }
    await Integration.updateOne({ _id: integration._id }, { $set: metadataPatch });

    // 6) Vincular la integración al negocio (evita duplicados)
    await Business.updateOne({ _id: business }, { $addToSet: { integrations: integration._id } });

    // 7) Recuperar integración "segura" (sin tokens) para responder
    const safeIntegration = await Integration.findOne({ business, type: 'meta' }).lean();

    return res.status(HttpStatusCode.Ok).send({
      message: "Instagram page connected successfully",
      integration: safeIntegration,
    });
  } catch (error) {
    next(error);
  }
}

// Controlador: obtener posts de la página (placeholder)
export async function getinstagramPostsController(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId } = req.params;
    // Permitir 'limit' tanto por query como por body (fallback a 10)
    const rawLimit = (req.query?.limit as string) || (req.body?.limit as string) || '10';
    const limit = Math.max(1, Math.min(50, parseInt(rawLimit, 10) || 10));

    if (!businessId) {
      return next(new CustomError(
        "Missing required parameter: businessId",
        HttpStatusCode.BadRequest
      ));
    }

    // Recuperar integración Meta y seleccionar explícitamente el access token
    const integration = await Integration.findOne({ business: businessId, type: 'meta' })
      .select('+config.accessToken')
      .lean();

    if (!integration) {
      return next(new CustomError("Meta integration not found for this business", HttpStatusCode.NotFound));
    }
    if (!integration.isConnected) {
      return next(new CustomError("Meta integration is not connected", HttpStatusCode.BadRequest));
    }

    const igUserId = integration.metadata?.instagramAccountId as string | undefined;
    const pageAccessToken = integration.config?.accessToken as string | undefined;

    if (!igUserId) {
      return next(new CustomError("Missing instagramAccountId in integration metadata", HttpStatusCode.BadRequest));
    }
    if (!pageAccessToken) {
      return next(new CustomError("Missing page access token in integration config", HttpStatusCode.BadRequest));
    }

    // Llamar al servicio de Instagram para obtener las últimas publicaciones
    const posts = await instagramService.getUserMedia(igUserId, pageAccessToken, limit);

    return res.status(HttpStatusCode.Ok).send({
      message: "Instagram posts fetched successfully",
      businessId,
      count: posts.length,
      limit,
      posts
    });
  } catch (error) {
    next(error);
  }
}