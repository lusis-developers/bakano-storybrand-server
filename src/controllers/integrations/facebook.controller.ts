import { Request, Response, NextFunction } from "express";
import { CreatePostPayload, facebookService } from "../../services/facebook.service";
import models from "../../models";
import { HttpStatusCode } from "axios";
import CustomError from "../../errors/customError.error";
import { Types } from "mongoose";

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

    const integration = await models.integration.upsertUserToken(business, longLivedUserToken, expiresInSeconds);

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
      pageAccessToken
    );


    if (!integration) {
      return next(new CustomError(
        'Could not find a pending integration for this business to finalize.',
        HttpStatusCode.NotFound
      ));
    }


    console.log(`[FacebookSavePageController] ✅ Integración finalizada para el negocio ${business} con la página ${pageName}.`);

    res.status(HttpStatusCode.Created).send({
      message: "Facebook Page integration completed successfully",
      integration
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
      type: 'meta',
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
      type: 'meta',
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