import { Request, Response, NextFunction } from "express";
import { HttpStatusCode } from "axios";
import CustomError from "../../errors/customError.error";
import { listLinkedInstagramAccounts, LinkedInstagramAccount } from "../../services/instagram-pages.service";
import { Integration } from "../../models/integration.model";
import { Business } from "../../models/business.model";
import models from "../../models";
import { facebookService } from "../../services/facebook.service";
import { instagramService } from "../../services/instagram.service";
import { Types } from "mongoose";
import { instagramPostService } from "../../services/instagramPost.service";
import type { CreateMediaContainerPayload } from "../../services/instagram.service";
import { instagramMetricsService } from "../../services/instagramMetrics.service";

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

      // Si viene el business, persistimos el token de usuario long-lived en la integración con estado "pending" para Instagram
      if (business) {
        await Integration.upsertUserToken(business, longLivedUserToken, expiresInSeconds || 5184000, 'instagram');
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
    let integration = await Integration.finalizeWithPageToken(business, pageId, resolvedPageName!, pageAccessToken, 'instagram');

    // Si no existía la integración previa (paso 1), creamos una nueva
    if (!integration) {
      integration = await Integration.create({
        name: `Instagram: ${resolvedPageName}`,
        description: 'Instagram Business',
        type: 'instagram',
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
    const safeIntegration = await Integration.findOne({ business, type: 'instagram' }).lean();

    // 8) Enriquecer respuesta con datos de perfil IG (foto de perfil y seguidores)
    let profile: { id: string; username?: string; profilePictureUrl?: string; followersCount?: number } | undefined;
    try {
      const igProfile = await instagramService.getUserProfile(instagramAccountId, pageAccessToken);
      profile = {
        id: igProfile.id,
        username: igProfile.username,
        profilePictureUrl: igProfile.profile_picture_url,
        followersCount: igProfile.followers_count,
      };
    } catch (e) {
      // No romper la respuesta si falla; solo loguear
      console.warn('[instagramSavePageController] No se pudo obtener el perfil de IG:', (e as Error).message);
    }

    return res.status(HttpStatusCode.Ok).send({
      message: "Instagram page connected successfully",
      integration: safeIntegration,
      instagram: profile,
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
    const integration = await Integration.findOne({ business: businessId, type: 'instagram' })
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
					"No image files provided in 'images' field",
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

		const msg = result.is_scheduled
			? `Instagram ${result.type} post scheduled successfully`
			: `Instagram ${result.type} post created successfully`;

		res.status(HttpStatusCode.Created).send({
			message: msg,
			data: {
				...result.data,
				container_id: result.container_id,
				is_scheduled: !!result.is_scheduled,
			},
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

export async function testInstagramPublishController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { businessId } = req.params;
    const { imageUrl, caption } = (req.body || {}) as {
      imageUrl?: string;
      caption?: string;
    };

    console.log('[IGTestPublish] Incoming request', { businessId, imageUrl, caption });

    if (!businessId || !Types.ObjectId.isValid(businessId)) {
      return next(
        new CustomError(
          "Invalid or missing businessId",
          HttpStatusCode.BadRequest
        )
      );
    }

    const integration = await Integration.findOne({
      business: businessId,
      type: "instagram",
      isConnected: true,
    })
      .select("+config.accessToken metadata.instagramAccountId")
      .lean();

    console.log('[IGTestPublish] Integration query finished', { found: !!integration });

    if (!integration) {
      return next(
        new CustomError(
          "Active Instagram integration not found for this business",
          HttpStatusCode.NotFound
        )
      );
    }

    const igUserId = (integration as any).metadata?.instagramAccountId as
      | string
      | undefined;
    const accessToken = (integration as any).config?.accessToken as
      | string
      | undefined;

    console.log('[IGTestPublish] Integration details', { igUserId, hasAccessToken: !!accessToken });

    if (!igUserId || !accessToken) {
      return next(
        new CustomError(
          "Instagram integration incomplete for this business",
          HttpStatusCode.BadRequest
        )
      );
    }

    const url = imageUrl && typeof imageUrl === "string" && imageUrl.length > 0
      ? imageUrl
      : "https://via.placeholder.com/640x640.png?text=API+Test";

    const payload: CreateMediaContainerPayload = {
      image_url: url,
      caption: caption || "API test post. Please ignore.",
      published: false,
    };

    console.log('[IGTestPublish] Creating media container', { igUserId, image_url: url });

    const container = await instagramService.createMediaContainer(
      igUserId,
      accessToken,
      payload
    );

    console.log('[IGTestPublish] Media container created', { containerId: container.id });

    res.status(HttpStatusCode.Created).send({
      message: "Instagram test media container created successfully",
      data: container,
    });
    return;
  } catch (error) {
    console.error('[IGTestPublish] Error', { error });
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

export async function getInstagramPageMetricsController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { businessId } = req.params;
    if (!businessId || !Types.ObjectId.isValid(businessId)) {
      res.status(HttpStatusCode.BadRequest).send({ message: 'Invalid or missing businessId parameter' });
      return;
    }
    try {
      const integration = await Integration.findOne({
        business: businessId,
        type: 'instagram',
        isConnected: true
      }).select('+config.accessToken metadata.instagramAccountId').lean();

      const accessToken = (integration as any)?.config?.accessToken as string | undefined;
      const igUserId = (integration as any)?.metadata?.instagramAccountId as string | undefined;

      if (!integration || !accessToken || !igUserId) {
        res.status(HttpStatusCode.NotFound).send({ message: 'Active Instagram integration not found or is incomplete for this business' });
        return;
      }

      const biz = await Business.findById(businessId).select('owner');
      const ownerUser = biz ? await models.user.findById(biz.owner).select('subscription.plan') : null;
      const userPlan = ((ownerUser?.subscription?.plan as any) || 'free') as 'free' | 'starter' | 'pro' | 'enterprise';
      const maxMonthsByPlan: Record<'free' | 'starter' | 'pro' | 'enterprise', number> = { free: 1, starter: 1, pro: 3, enterprise: 6 };
      const maxDaysByPlan: Record<'free' | 'starter' | 'pro' | 'enterprise', number> = { free: 28, starter: 28, pro: 90, enterprise: 180 };

      const q = req.query as any;
      const requestedMonths = Math.max(1, Math.min(Number(q.months || 1), maxMonthsByPlan[userPlan]));
      const now = new Date();

      const startOfMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0));
      const endOfMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59));
      const monthsAgo = (d: Date, m: number) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - m, 1, 0, 0, 0));
      const diffDays = (a: Date, b: Date) => Math.ceil((b.getTime() - a.getTime()) / 86400000);
      const formatLocalDateTime = (d: Date, tz?: string, offsetMinutes?: number): { date: string; time: string } => {
        if (tz && tz.trim()) {
          const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(d);
          const get = (type: string) => parts.find(p => p.type === type)?.value || '';
          const year = get('year');
          const month = get('month');
          const day = get('day');
          const hour = get('hour');
          const minute = get('minute');
          return { date: `${year}-${month}-${day}`, time: `${hour}:${minute}` };
        }
        if (Number.isFinite(offsetMinutes)) {
          const adj = new Date(d.getTime() + (offsetMinutes as number) * 60000);
          const iso = adj.toISOString();
          return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
        }
        const iso = d.toISOString();
        return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
      };

      let effectivePeriod: any = (q.period as any) || undefined;
      let effectiveSince: string | undefined = q.since as string | undefined;
      let effectiveUntil: string | undefined = q.until as string | undefined;
      let effectivePreset: any = (q.date_preset as any) || undefined;
      let adjusted = false;
      let appliedView = ((q.view || '') as string).toLowerCase();
      if (!appliedView) appliedView = 'month';
      if (appliedView === 'week') {
        effectivePeriod = 'day';
        effectivePreset = 'last_7d';
        effectiveSince = undefined;
        effectiveUntil = undefined;
      } else if (appliedView === 'month') {
        const end = endOfMonth(now);
        const start = monthsAgo(now, requestedMonths - 1);
        const sinceDate = startOfMonth(start);
        const untilDate = end;
        const days = diffDays(sinceDate, untilDate);
        const allowedDays = Math.min(maxDaysByPlan[userPlan], 90);
        if (days > allowedDays) {
          effectivePeriod = 'day';
          effectiveSince = undefined;
          effectiveUntil = undefined;
          adjusted = true;
          effectivePreset = userPlan === 'free' || userPlan === 'starter' ? 'last_28d' : 'last_90d';
        } else {
          effectivePeriod = 'day';
          effectivePreset = undefined;
          effectiveSince = sinceDate.toISOString();
          effectiveUntil = untilDate.toISOString();
        }
      } else if (appliedView === 'custom') {
        if (effectiveSince && effectiveUntil) {
          const s = new Date(effectiveSince);
          const u = new Date(effectiveUntil);
          const days = diffDays(s, u);
          const allowedDays = Math.min(maxDaysByPlan[userPlan], 90);
          if (days > allowedDays) {
            effectivePeriod = 'day';
            effectiveSince = undefined;
            effectiveUntil = undefined;
            adjusted = true;
            effectivePreset = userPlan === 'free' || userPlan === 'starter' ? 'last_28d' : 'last_90d';
          } else {
            effectivePeriod = 'day';
            effectivePreset = undefined;
            adjusted = false;
          }
        } else {
          effectivePeriod = 'day';
          effectivePreset = 'last_28d';
          adjusted = true;
        }
      } else {
        effectivePeriod = 'day';
        effectivePreset = 'this_month';
        effectiveSince = undefined;
        effectiveUntil = undefined;
      }

      const metrics = [
        'reach',
        'profile_views',
        'accounts_engaged',
        'total_interactions',
        'likes',
        'comments',
        'shares',
        'saves',
        'follows_and_unfollows',
        'views'
      ];

      const [profile, insights] = await Promise.all([
        instagramService.getUserProfile(igUserId, accessToken),
        instagramService.getUserInsights(igUserId, accessToken, metrics, {
          period: effectivePeriod || 'day',
          since: effectiveSince,
          until: effectiveUntil,
          date_preset: effectivePreset || undefined,
          metric_type: 'total_value',
          breakdown: (q.breakdown as string | undefined)
        })
      ]);

      let reachSeries: Array<{ end_time?: string; value?: number }> = [];
      const wantSeries = String(q.series || '').toLowerCase() === 'true' || String(q.series || '') === '1';
      if (wantSeries) {
        const ts = await instagramService.getUserInsights(igUserId, accessToken, ['reach'], {
          period: 'day',
          since: effectiveSince,
          until: effectiveUntil,
          date_preset: effectivePreset || undefined,
          metric_type: 'time_series'
        });
        const reachTs = (ts as any)?.reach || {};
        reachSeries = Array.isArray(reachTs.values) ? reachTs.values : [];
      }

      const tz = q.tz && (q.tz as string).trim() ? (q.tz as string).trim() : undefined;
      const offsetMinutes = q.offsetMinutes !== undefined ? Number(q.offsetMinutes) : undefined;

      const formattedMetrics: Record<string, { total: number; averagePerDay: number; series?: Array<{ date: string; time: string; value: number }>; breakdown?: Array<{ label: string; value: number }> }> = {};
      Object.keys(insights || {}).forEach((key) => {
        const metric = (insights as any)[key] || {};
        let values = Array.isArray(metric.values) ? metric.values : [];
        if (key === 'reach' && reachSeries.length > 0) {
          values = reachSeries;
        }
        const series = values.map((v: any) => {
          const dt = v?.end_time ? new Date(v.end_time) : undefined;
          const loc = dt ? formatLocalDateTime(dt, tz, offsetMinutes) : { date: '', time: '' };
          const value = typeof v?.value === 'number' ? v.value : 0;
          return { date: loc.date, time: loc.time, value };
        });
        const total = typeof metric.total === 'number' ? metric.total : 0;
        let averagePerDay = 0;
        if (series.length > 0) {
          averagePerDay = Math.round(total / series.length);
        } else {
          let days = 0;
          if (effectiveSince && effectiveUntil) {
            const s = new Date(effectiveSince);
            const u = new Date(effectiveUntil);
            days = Math.max(1, Math.ceil((u.getTime() - s.getTime()) / 86400000));
          } else if (effectivePreset === 'last_28d') {
            days = 28;
          } else if (effectivePreset === 'last_90d') {
            days = 90;
          } else if (effectivePreset === 'this_month') {
            const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
            const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
            days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
          }
          averagePerDay = days > 0 ? Math.round(total / days) : 0;
        }
        const entry: any = { total, averagePerDay };
        if (series.length > 0) entry.series = series;
        if (Array.isArray(metric.breakdown) && metric.breakdown.length > 0) {
          entry.breakdown = metric.breakdown.map((b: any) => ({ label: b.label, value: b.value }));
        }
        formattedMetrics[key] = entry;
      });

      const data = {
        instagram: {
          id: (profile as any)?.id || igUserId,
          username: (profile as any)?.username,
          profilePictureUrl: (profile as any)?.profile_picture_url,
          followersCount: (profile as any)?.followers_count
        },
        insights: {
          period: effectivePeriod || 'day',
          date_preset: effectivePreset || undefined,
          range: effectiveSince || effectiveUntil ? { since: effectiveSince, until: effectiveUntil } : undefined,
          timezone: tz || (Number.isFinite(offsetMinutes) ? `UTC${(offsetMinutes as number) >= 0 ? '+' : ''}${offsetMinutes}` : 'UTC'),
          metrics: formattedMetrics
        }
      };

      const filters = {
        plan: userPlan,
        maxMonthsByPlan: maxMonthsByPlan[userPlan],
        maxDaysByPlan: maxDaysByPlan[userPlan],
        view: appliedView,
        monthsApplied: appliedView === 'month' ? requestedMonths : undefined,
        adjusted
      };

      res.status(HttpStatusCode.Ok).send({
        message: 'Instagram page metrics retrieved successfully',
        data,
        filters
      });
      return;
    } catch (e: any) {
      res.status(HttpStatusCode.BadRequest).send({ message: e?.message || 'Error retrieving Instagram page metrics' });
      return;
    }
  } catch (error: any) {
    console.error('[GetInstagramPageMetricsController] ❌ Error:', error?.message);
    next(error);
  }
}

export async function getInstagramFollowersMetricsController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { businessId } = req.params;
    const q = req.query as any;
    if (!businessId || !Types.ObjectId.isValid(businessId)) {
      res.status(HttpStatusCode.BadRequest).send({ message: 'Invalid or missing businessId parameter' });
      return;
    }

    try {
      const integration = await Integration.findOne({
        business: businessId,
        type: 'instagram',
        isConnected: true
      }).select('+config.accessToken metadata.instagramAccountId').lean();

      const accessToken = (integration as any)?.config?.accessToken as string | undefined;
      const igUserId = (integration as any)?.metadata?.instagramAccountId as string | undefined;

      if (!integration || !accessToken || !igUserId) {
        res.status(HttpStatusCode.NotFound).send({ message: 'Active Instagram integration not found or is incomplete for this business' });
        return;
      }

      const biz = await Business.findById(businessId).select('owner');
      const ownerUser = biz ? await models.user.findById(biz.owner).select('subscription.plan') : null;
      const userPlan = ((ownerUser?.subscription?.plan as any) || 'free') as 'free' | 'starter' | 'pro' | 'enterprise';
      const maxDaysByPlan: Record<'free' | 'starter' | 'pro' | 'enterprise', number> = { free: 28, starter: 28, pro: 90, enterprise: 180 };

      const now = new Date();
      const startOfMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0));
      const endOfMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59));
      const monthsAgo = (d: Date, m: number) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - m, 1, 0, 0, 0));
      const diffDays = (a: Date, b: Date) => Math.ceil((b.getTime() - a.getTime()) / 86400000);
      const formatLocalDateTime = (d: Date, tz?: string, offsetMinutes?: number): { date: string; time: string } => {
        const tzParam = q.tz && String(q.tz).trim() ? String(q.tz).trim() : undefined;
        const offParam = q.offsetMinutes !== undefined ? Number(q.offsetMinutes) : undefined;
        if (tzParam) {
          const parts = new Intl.DateTimeFormat('en-US', { timeZone: tzParam, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(d);
          const get = (type: string) => parts.find(p => p.type === type)?.value || '';
          return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
        }
        if (Number.isFinite(offParam)) {
          const adj = new Date(d.getTime() + (offParam as number) * 60000);
          const iso = adj.toISOString();
          return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
        }
        const iso = d.toISOString();
        return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
      };

      const wantSeries = String(q.series || '').toLowerCase() === 'true' || String(q.series || '') === '1';

      const profile = await instagramService.getUserProfile(igUserId, accessToken);
      const currentFollowers = (profile as any)?.followers_count || 0;

      type WindowKey = '1m' | '3m' | '6m';
      const targets: { key: WindowKey; days: number; preset?: 'last_28d' | 'last_90d'; months?: number }[] = [
        { key: '1m', days: 28, preset: 'last_28d' },
        { key: '3m', days: 90 },
        { key: '6m', days: 180 }
      ];

      const windows: Record<WindowKey, any> = {} as any;

      for (const t of targets) {
        const allowedDays = maxDaysByPlan[userPlan];
        if (t.days > allowedDays) {
          // Skip windows not allowed by plan
          continue;
        }

        let since: string | undefined;
        let until: string | undefined;
        let date_preset: string | undefined;

        // follower_count only allows querying last 30 days excluding current day
        // Prefer presets when available; for custom range ensure 'until' is yesterday
        if (t.preset) {
          date_preset = t.preset;
        }

        // Ensure custom since/until adhere to API constraints when not using preset
        if (!date_preset) {
          const yesterday = new Date(Date.now() - 86400000);
          const untilDate = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate(), 23, 59, 59));
          const sinceDate = new Date(untilDate.getTime() - t.days * 86400000);
          since = sinceDate.toISOString();
          until = untilDate.toISOString();
        }

        let netChange = 0;
        let series: any[] = [];
        if (t.days <= 30) {
          const insight = await instagramService.getUserInsights(igUserId, accessToken, ['follower_count'], {
            period: 'day',
            since,
            until,
            date_preset: date_preset as any,
            metric_type: 'time_series'
          });
          series = Array.isArray((insight as any)?.follower_count?.values) ? (insight as any).follower_count.values : [];
          netChange = series.reduce((sum: number, v: any) => sum + (typeof v.value === 'number' ? v.value : 0), 0);
          await instagramMetricsService.upsertLast30DaysFollowerDeltas(businessId, igUserId, accessToken);
        } else {
          const agg = await instagramMetricsService.getNetChange(igUserId, t.days);
          netChange = agg.netChange;
          series = [];
        }
        const startEstimate = currentFollowers - netChange;

        const formattedSeries = wantSeries
          ? series.map((v: any) => {
              const dt = v?.end_time ? new Date(v.end_time) : undefined;
              const loc = dt ? formatLocalDateTime(dt, q.tz, q.offsetMinutes) : { date: '', time: '' };
              return { date: loc.date, time: loc.time, value: typeof v.value === 'number' ? v.value : 0 };
            })
          : undefined;

        windows[t.key] = {
          months: t.days === 28 ? 1 : (t.days === 90 ? 3 : 6),
          range: since && until ? { since, until } : undefined,
          preset: date_preset,
          netChange,
          currentFollowers,
          estimatedStartFollowers: startEstimate,
          series: formattedSeries
        };
      }

      const tz = q.tz && q.tz.trim() ? q.tz.trim() : undefined;
      const offsetMinutes = q.offsetMinutes !== undefined ? Number(q.offsetMinutes) : undefined;

      res.status(HttpStatusCode.Ok).send({
        message: 'Instagram followers growth metrics retrieved successfully',
        data: {
          instagram: {
            id: (profile as any)?.id || igUserId,
            username: (profile as any)?.username,
            profilePictureUrl: (profile as any)?.profile_picture_url,
            followersCount: currentFollowers
          },
          timezone: tz || (Number.isFinite(offsetMinutes) ? `UTC${(offsetMinutes as number) >= 0 ? '+' : ''}${offsetMinutes}` : 'UTC'),
          windows,
          comparisons: await (async () => {
            if (String(q.compare || '').toLowerCase() !== 'month') return undefined;
            // follower_count supports only last 30 days excluding current day; compute current month netChange
            const yesterday = new Date(Date.now() - 86400000);
            const untilCurDate = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate(), 23, 59, 59));
            const sinceCurDate = new Date(untilCurDate.getTime() - 28 * 86400000);
            const curInsight = await instagramService.getUserInsights(igUserId, accessToken, ['follower_count'], {
              period: 'day',
              since: sinceCurDate.toISOString(),
              until: untilCurDate.toISOString(),
              metric_type: 'time_series'
            });
            const curSeries = Array.isArray((curInsight as any)?.follower_count?.values) ? (curInsight as any).follower_count.values : [];
            const curNet = curSeries.reduce((s: number, v: any) => s + (typeof v.value === 'number' ? v.value : 0), 0);
            const prevEndFollowers = currentFollowers - curNet;
            const changeAbs = curNet;
            const changePct = prevEndFollowers > 0 ? Math.round((changeAbs / prevEndFollowers) * 100) : 0;
            return {
              month: {
                current: { endFollowers: currentFollowers, netChange: curNet },
                previous: { endFollowers: prevEndFollowers },
                change: { absolute: changeAbs, percent: changePct },
                ranges: {
                  current: { since: sinceCurDate.toISOString(), until: untilCurDate.toISOString() }
                }
              }
            };
          })()
        }
      });
      return;
    } catch (e: any) {
      res.status(HttpStatusCode.BadRequest).send({ message: e?.message || 'Error retrieving Instagram followers growth metrics' });
      return;
    }
  } catch (error: any) {
    console.error('[GetInstagramFollowersMetricsController] ❌ Error:', error?.message);
    next(error);
  }
}