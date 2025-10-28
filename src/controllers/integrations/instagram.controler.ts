import { Request, Response, NextFunction } from "express";
import { HttpStatusCode } from "axios";
import CustomError from "../../errors/customError.error";
import { listLinkedInstagramAccounts, LinkedInstagramAccount } from "../../services/instagram-pages.service";
import { Integration } from "../../models/integration.model";
import { Business } from "../../models/business.model";
import { facebookService } from "../../services/facebook.service";
import { instagramService } from "../../services/instagram.service";
import { Types } from "mongoose";
import { instagramPostService } from "../../services/instagramPost.service";

export async function instagramConnectController(req: Request, res: Response, next: NextFunction) {
  try {
    const { accessToken, business } = req.body || {};
    if (!accessToken) {
      return next(new CustomError(
        "Missing required parameter: accessToken",
        HttpStatusCode.BadRequest
      ));
    }

    // Intercambiar el token corto por long-lived para evitar caducidad temprana
    let longLivedUserToken: string = accessToken;
    let expiresInSeconds: number | undefined;
    let expiresAt: Date | undefined;
    try {
      const exchange = await facebookService.exchangeLongLivedUserAccessToken(accessToken);
      longLivedUserToken = exchange.access_token;
      expiresInSeconds = exchange.expires_in || 5184000; // ~60 días
      expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

      // Si viene el business, persistimos el token de usuario long-lived en la integración con estado "pending"
      if (business) {
        await Integration.upsertUserToken(business, longLivedUserToken, expiresInSeconds);
      }
    } catch (e) {
      console.warn('[instagramConnectController] No se pudo intercambiar el token de usuario por long-lived, se usará el recibido. Esto puede caducar pronto:', (e as Error).message);
    }

    // Usar el token long-lived (o el original si falló el intercambio) para listar las páginas con IG
    const accounts: LinkedInstagramAccount[] = await listLinkedInstagramAccounts(longLivedUserToken);

    return res.status(HttpStatusCode.Ok).send({
      message: "Linked Instagram Business accounts fetched successfully",
      accounts,
      count: accounts.length,
      // Exponemos información de expiración para diagnóstico; puedes remover `token` si no quieres retornarlo
      token: {
        type: 'user_long_lived',
        accessToken: longLivedUserToken,
        expiresIn: expiresInSeconds,
        expiresAt
      }
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


    const posts = await instagramService.getUserMedia(igUserId, pageAccessToken, limit);

    const postIds = posts.map(post => post.id);

    const insightsMap = await instagramService.getMultipleMediaInsights(postIds, pageAccessToken);
    
    const postsWithInsights = posts.map(post => ({
      ...post, // El post original (con id, caption, like_count, comments_count...)
      insights: insightsMap.get(post.id) || null // El objeto de insights (engagement, reach...)
    }));

   return res.status(HttpStatusCode.Ok).send({
      message: "Instagram posts and insights fetched successfully",
      businessId,
      count: postsWithInsights.length,
      limit,
      posts: postsWithInsights // <-- Enviamos el array enriquecido
    });
  } catch (error) {
    next(error);
  }
}

export async function createInstagramPhotoPostController(
	req: Request,
	res: Response,
	next: NextFunction
) {
	try {
		const { businessId } = req.params;

		const files = req.files as Express.Multer.File[];

		if (!businessId || !Types.ObjectId.isValid(businessId)) {
			return next(
				new CustomError(
					"Invalid or missing businessId",
					HttpStatusCode.BadRequest
				)
			);
		}

		if (!files || files.length === 0) {
			return next(
				new CustomError(
					"No image file sprovided in 'images', field",
					HttpStatusCode.BadRequest
				)
			);
		}

		console.log(
			`[IGPhotoController] Delegando post de foto/carrusel (${files.length} archivos) al servicio...`
		);

		const result = await instagramPostService.publishPhotoOrCarouselPost(
			businessId,
			req.body,
			files
		);
		console.log(
			`[IGPhotoController] Servicio completó la publicación tipo: ${result.type}.`
		);

		res.status(HttpStatusCode.Created).send({
			message: `Instagram ${result.type} post created succesfully`,
			data: result.data,
		});

		return;
	} catch (error: any) {
		console.error(
			"[CreateInstagramPhotoPostController] ❌ Error:",
			error.message
		);
		next(error);
	}
}

/**
 * =============================================================
 * CONTROLADOR (PARA REELS DE INSTAGRAM)
 * =============================================================
 * Maneja la solicitud HTTP para crear un Reel (video) en Instagram.
 * Delega toda la lógica de negocio al InstagramPostService.
 */
export async function createInstagramReelController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { businessId } = req.params;
    
    // 1. VALIDAR ENTRADA
    const file = req.file as Express.Multer.File | undefined; // Archivo desde multer.single('video')

    if (!businessId || !Types.ObjectId.isValid(businessId)) {
      return next(new CustomError("Invalid or missing businessId", HttpStatusCode.BadRequest));
    }
    
    // Asegurar que multer envió el archivo de video
    if (!file) {
      return next(new CustomError("No video file provided in 'video' field", HttpStatusCode.BadRequest));
    }

    // 2. DELEGAR AL SERVICIO ORQUESTADOR
    console.log(`[IGReelController] Delegando post de Reel al servicio...`);
    const result = await instagramPostService.publishReelPost(
      businessId, 
      req.body, // Pasamos el body (caption, share_to_feed, etc.)
      file      // Pasamos el archivo de video
    );
    console.log(`[IGReelController] Servicio completó la publicación tipo: ${result.type}.`);

    // 3. ENVIAR RESPUESTA ÉXITOSA (201 Created)
    res.status(HttpStatusCode.Created).send({
      message: `Instagram ${result.type} post created successfully`,
      data: result.data // Contiene el ID final del media de Instagram
    });

  } catch (error: any) {
     // Captura errores del servicio o validación
    console.error('[CreateInstagramReelController] ❌ Error:', error.message);
    next(error); // Pasa al manejador de errores global
  }
}