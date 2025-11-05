import { Request, Response, NextFunction } from "express";
import { CreatePostPayload, facebookService } from "../../services/facebook.service";
import models from "../../models";
import { HttpStatusCode } from "axios";
import CustomError from "../../errors/customError.error";
import { Types } from "mongoose";
import { facebookPostService } from "../../services/facebookPost.service";

/**
 * Handles the first step of Facebook connection:
 * 1. Exchanges a short-lived token for a long-lived one.
 * 2. Saves the user token in an integration document with status "pending".
 * 3. Updates the business document to add a reference to this integration.
 * 4. Retrieves and returns the list of pages the user manages.
 */
export async function facebookConnectController(req: Request, res: Response, next: NextFunction) {
  try {
    const { business, accessToken } = req.body;

    if (!business || !accessToken) {
      return next(new CustomError(
        'Missing required parameters: business and accessToken',
        HttpStatusCode.BadRequest
      ));
    }
    
    const exchange = await facebookService.exchangeLongLivedUserAccessToken(accessToken);
    const { access_token: longLivedUserToken, expires_in } = exchange;
    const expiresInSeconds = expires_in || 5184000; // Por defecto 60 días

    const integration = await models.integration.upsertUserToken(business, longLivedUserToken, expiresInSeconds, 'facebook');

    await models.business.findByIdAndUpdate(
      business,
      { $addToSet: { integrations: integration._id } }
    );

    const pages = await facebookService.getUserPages(longLivedUserToken);

    if (pages.length === 0) {
      return res.status(HttpStatusCode.Ok).send({
        message: "User connected successfully but no manageable pages were found.",
        pages: []
      });
    }

    return res.status(HttpStatusCode.Ok).send({
      message: "User pages retrieved successfully. Please select a page to connect.",
      pages: pages.map(page => ({
        id: page.id,
        name: page.name,
        category: page.category,
        accessToken: page.access_token,
        pictureUrl: page.picture.data.url
      }))
    });

  } catch (error: any) {
    console.error('[FacebookConnectController] ❌ Error in facebookConnectController:', error?.response?.data || error?.message);
    next(error);
  }
}

export async function facebookSavePageController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { business, pageId, pageName, pageAccessToken } = req.body

    if(!business || !pageId || !pageAccessToken) {
      return next(new CustomError(
        'Missing required parameters: business, pageId, and pageAccessToken',
        HttpStatusCode.BadRequest
      ));
    }

    const integration = await models.integration.finalizeWithPageToken(
      business,
      pageId,
      pageName,
      pageAccessToken,
      'facebook'
    );


    if (!integration) {
      return next(new CustomError(
        'Could not find a pending integration for this business to finalize.',
        HttpStatusCode.NotFound
      ));
    }


    console.log(`[FacebookSavePageController] ✅ Integración finalizada para el negocio ${business} con la página ${pageName}.`);

    const picture = {
      url: facebookService.getPageProfilePictureRedirectUrl(pageId),
      small: facebookService.getPageProfilePictureRedirectUrl(pageId, { type: 'small' }),
      normal: facebookService.getPageProfilePictureRedirectUrl(pageId, { type: 'normal' }),
      large: facebookService.getPageProfilePictureRedirectUrl(pageId, { type: 'large' }),
      size150: facebookService.getPageProfilePictureRedirectUrl(pageId, { width: 150, height: 150 }),
    };

    res.status(HttpStatusCode.Created).send({
      message: "Facebook Page integration completed successfully",
      integration,
      page: {
        id: pageId,
        name: pageName,
        picture,
      }
    });

    return

  } catch (error: any) {
    console.error('[FacebookSavePageController] ❌ Error in facebookSavePageController:', error?.response?.data || error?.message);
    next(error);
  }
}

export async function getFacebookPostsController(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId } = req.params;

    const integration = await models.integration.findOne({ 
      business: businessId, 
      type: 'facebook',
      isConnected: true 
    }).select('+config.accessToken');

    if (!integration || !integration.config.accessToken || !integration.metadata?.pageId) {
      return res.status(HttpStatusCode.NotFound).send({ message: 'Facebook integration not found or is incomplete for this business' });
    }

    const pageAccessToken = integration.config.accessToken;
    const pageId = integration.metadata.pageId;

    // 1. Obtener las publicaciones como antes.
    const posts = await facebookService.getPagePosts(pageAccessToken, pageId);

    if (posts.length === 0) {
      return res.status(HttpStatusCode.Ok).send({ message: `Found 0 posts for page ${pageId}`, posts: [] });
    }

    // 2. Extraer los IDs de las publicaciones para la petición por lotes.
    const postIds = posts.map(post => post.id);

    // 3. Obtener todas las estadísticas en una sola llamada a la API.
    const insightsMap = await facebookService.getPostsInsights(pageAccessToken, postIds);

    // 4. Enriquecer cada publicación con sus estadísticas correspondientes.
    const postsWithInsights = posts.map(post => ({
      ...post,
      insights: insightsMap.get(post.id) || null // Añadimos el objeto de insights
    }));

    return res.status(HttpStatusCode.Ok).send({
      message: `Found ${postsWithInsights.length} posts for page ${pageId}`,
      posts: postsWithInsights // Enviamos las publicaciones enriquecidas
    });

  } catch (error: any) {
    console.error('[GetFacebookPostsController] ❌ Error in getFacebookPostsController:', error?.response?.data || error?.message);
    res.status(500).send({ message: 'Error retrieving Facebook posts' });
  }
}

export async function createPostController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {

    const { businessId } = req.params;
    
    const {
      message,
      link, 
      published,
      scheduled_publish_time
    } = req.body as CreatePostPayload

    if (!businessId || !Types.ObjectId.isValid(businessId)) {
      return next(new CustomError(
       "Invalid or missing businessId parameter", 
        HttpStatusCode.BadRequest
      ));
    }

    if(!message) {
      return next(new CustomError(
        "missing required body field: message", 
        HttpStatusCode.BadRequest
      ))
    }

    const integration = await models.integration.findOne({ 
      business: businessId, 
      type: 'facebook',
      isConnected: true 
    }).select('+config.accessToken');

    if (!integration || !integration.config.accessToken || !integration.metadata?.pageId) {
      return next(new CustomError(
        'Active Facebook integration not found or is incomplete for this business', 
        HttpStatusCode.NotFound
      ));
    }

    const pageAccessToken = integration.config.accessToken;
    const pageId = integration.metadata.pageId;

    // 3. PREPARAR Y LLAMAR AL SERVICIO
    const payload: CreatePostPayload = {
      message,
      link,
      published,
      scheduled_publish_time
    };

    const newPost = await facebookService.createPagePost(
      pageAccessToken,
      pageId,
      payload
    );

    // 4. RESPONDER
    res.status(HttpStatusCode.Created).send({
      message: "Facebook text post created successfully",
      data: newPost
    });

  } catch (error: any) {
    console.error('[CreatePostController] ❌ Error in createPostController:', error?.response?.data || error?.message);
    next(error);
  }
}

export async function createFacebookPhotoPostController(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Siempre dentro de un try...catch
  try {
    // 1. OBTENER Y VALIDAR ENTRADA
    const { businessId } = req.params;
    
    // Los archivos vienen de req.files gracias al middleware 'multer'
    const files = req.files as Express.Multer.File[]; 

    // Validamos el businessId
    if (!businessId || !Types.ObjectId.isValid(businessId)) {
      // Pasamos el error al middleware con next()
      return next(new CustomError(
        "Invalid or missing businessId parameter", 
        HttpStatusCode.BadRequest
      ));
    }
    
    // Validamos que multer nos haya entregado archivos
    if (!files || files.length === 0) {
      return next(new CustomError(
        "No image files were uploaded. Ensure the field name in FormData is 'images'.", 
        HttpStatusCode.BadRequest
      ));
    }

    // 2. DELEGAR AL SERVICIO ORQUESTADOR
    // El controlador no sabe nada de Cloudinary, modelos, ni lógica de Facebook.
    // Solo pasa la información validada al servicio que SÍ sabe.
    console.log(`[FBPhotoController] Delegando la publicación de ${files.length} foto(s) al servicio...`);
    const result = await facebookPostService.publishPhotoPost(
      businessId, 
      req.body, // Pasamos todo el body (el servicio extraerá message, published, etc.)
      files      // Pasamos los archivos
    );
    console.log(`[FBPhotoController] Servicio completó la publicación tipo: ${result.type}`);

    // 3. ENVIAR RESPUESTA ÉXITOSA (201 Created)
    res.status(HttpStatusCode.Created).send({
      message: `Facebook ${result.type} post created successfully`, // Mensaje dinámico (photo o carousel)
      data: result.data // Los IDs devueltos por Facebook
    });

  } catch (error: any) {
    // Si facebookPostService (o la validación inicial) lanza un error, lo capturamos aquí.
    console.error('[CreateFacebookPhotoPostController] ❌ Error en el flujo:', error.message);
    // Pasamos el error al middleware global para que maneje la respuesta de error (4xx o 500)
    next(error); 
  }
}

export async function createFacebookVideoPostController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { businessId } = req.params;

    // 1. INPUT VALIDATION
    // Multer (with .single('video')) will place the file in req.file
    const file = req.file as Express.Multer.File | undefined;

    // Validate businessId
    if (!businessId || !Types.ObjectId.isValid(businessId)) {
      return next(new CustomError("Invalid or missing businessId", HttpStatusCode.BadRequest));
    }

    // Validate that multer provided ONE file
    if (!file) {
      return next(new CustomError("No video file provided in 'video' field", HttpStatusCode.BadRequest));
    }

    // 2. DELEGATE TO SERVICE
    const result = await facebookPostService.publishVideoPost(
      businessId,
      req.body, // Pass body (description, title, published, etc.)
      file      // Pass file
    );

    // 3. SEND SUCCESS RESPONSE (201 Created)
    res.status(HttpStatusCode.Created).send({
      message: `Facebook ${result.type} post created successfully`,
      data: result.data // Contains { video_id: "..." }
    });

  } catch (error: any) {
    next(error); // Pass to error middleware
  }
}

export async function getFacebookScheduledPostsController(req: Request, res: Response, next: NextFunction) {
  try {
    // 1. OBTENER Y VALIDAR PARÁMETROS
    const { businessId } = req.params;
    // Filtros/profesional: limit, rango de fechas (from/to), búsqueda por texto (q), orden (sort)
    const { limit: qLimit, from, to, q, sort } = req.query as Record<string, string | undefined>;
    const limit = Math.min(Math.max(Number(qLimit || 25), 1), 100); // 1..100

    const parseTsSeconds = (val?: string): number | undefined => {
      if (!val) return undefined;
      const n = Number(val);
      if (!Number.isNaN(n) && Number.isFinite(n)) {
        // Si viene en segundos, lo usamos directo; si parece milisegundos, convertimos a segundos
        return n > 1e12 ? Math.floor(n / 1000) : Math.floor(n);
      }
      const ms = Date.parse(val);
      return Number.isNaN(ms) ? undefined : Math.floor(ms / 1000);
    };
    const fromSec = parseTsSeconds(from);
    const toSec = parseTsSeconds(to);
    const queryText = (q || "").toLowerCase().trim();
    const sortOrder = (sort === 'desc' || sort === 'asc') ? sort : 'asc';

    if (!businessId || !Types.ObjectId.isValid(businessId)) {
      return next(new CustomError(
        "Invalid or missing businessId parameter", 
        HttpStatusCode.BadRequest
      ));
    }

    // 2. BUSCAR INTEGRACIÓN
    const integration = await models.integration.findOne({ 
      business: businessId, 
      type: 'facebook',
      isConnected: true 
    }).select('+config.accessToken');

    if (!integration || !integration.config.accessToken || !integration.metadata?.pageId) {
      return next(new CustomError(
        'Active Facebook integration not found or is incomplete for this business', 
        HttpStatusCode.NotFound
      ));
    }

    const pageAccessToken = integration.config.accessToken;
    const pageId = integration.metadata.pageId;

    // 3. LLAMAR AL SERVICIO
    // (Nota: No pedimos insights porque no existen para posts no publicados)
    const scheduledPosts = await facebookService.getScheduledPagePosts(
      pageAccessToken,
      pageId,
      limit
    );

    // 3.1 Aplicar filtros en memoria (Facebook no soporta todos estos filtros en el endpoint)
    let filtered = scheduledPosts.filter(p => {
      if (fromSec && p.scheduled_publish_time < fromSec) return false;
      if (toSec && p.scheduled_publish_time > toSec) return false;
      if (queryText) {
        const msg = (p.message || '').toLowerCase();
        if (!msg || !msg.includes(queryText)) return false;
      }
      return true;
    });

    // 3.2 Ordenar
    filtered.sort((a, b) => {
      return sortOrder === 'desc'
        ? b.scheduled_publish_time - a.scheduled_publish_time
        : a.scheduled_publish_time - b.scheduled_publish_time;
    });

    // 3.3 Métricas profesionales
    const count = filtered.length;
    const times = filtered.map(p => p.scheduled_publish_time);
    const range = times.length
      ? { from: Math.min(...times), to: Math.max(...times) }
      : { from: null, to: null };
    const byDayMap = new Map<string, number>();
    for (const p of filtered) {
      const day = new Date(p.scheduled_publish_time * 1000).toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
      byDayMap.set(day, (byDayMap.get(day) || 0) + 1);
    }
    const byDay = Object.fromEntries(byDayMap);

    // 4. RESPONDER
    if (filtered.length === 0) {
      return res.status(HttpStatusCode.Ok).send({ 
        message: `Found 0 scheduled posts for page ${pageId}`,
        page: { id: pageId, name: integration.metadata?.pageName || undefined },
        count: 0,
        filters: { limit, from: fromSec, to: toSec, q: queryText || undefined, sort: sortOrder },
        stats: { range, byDay },
        posts: [] 
      });
    }

    return res.status(HttpStatusCode.Ok).send({
      message: `Found ${count} scheduled posts for page ${pageId}`,
      page: { id: pageId, name: integration.metadata?.pageName || undefined },
      count,
      filters: { limit, from: fromSec, to: toSec, q: queryText || undefined, sort: sortOrder },
      stats: { range, byDay },
      posts: filtered
    });

  } catch (error: any) {
    // 5. MANEJO DE ERRORES
    console.error('[GetFacebookScheduledPostsController] ❌ Error:', error.message);
    // El servicio ya simplificó el error, solo lo pasamos al middleware
    next(error);
  }
}