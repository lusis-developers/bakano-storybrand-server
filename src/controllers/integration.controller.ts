import { Request, Response, NextFunction } from "express";
import { facebookService } from "../services/facebook.service";
import models from "../models";
import { HttpStatusCode } from "axios";
import CustomError from "../errors/customError.error";

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