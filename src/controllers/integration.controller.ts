import { Request, Response, NextFunction } from "express";
import { facebookService } from "../services/facebook.service";
import models from "../models";
import { Types } from "mongoose";
import { HttpStatusCode } from "axios";
import CustomError from "../errors/customError.error";

export async function facebookConnectController(req: Request, res: Response, next: NextFunction) {
  try {
    const { business, accessToken } = req.body;

    if (!business || !accessToken) {
      return next(new CustomError(
        'Missing required parameters: business and accessToken',
        HttpStatusCode.BadRequest
      ));
    }

    if (!Types.ObjectId.isValid(business)) {
      return next(new CustomError(
        'Invalid business ID format',
        HttpStatusCode.BadRequest
      ));
    }

    const exchange = await facebookService.exchangeLongLivedUserAccessToken(accessToken);

    const integration = await models.integration.upsertMetaAccessToken(
      business,
      exchange.access_token,
      exchange.expires_in
    );

    console.log('integration', integration)

    return res.status(HttpStatusCode.Ok).send({
      message: "Facebook integration connected successfully",
      integration: {
        id: integration._id,
        type: integration.type,
        business: integration.business,
        isConnected: integration.isConnected,
        connectionStatus: integration.connectionStatus
      }
    });
  } catch (error: any) {
    console.error('[FacebookConnectController] ❌ Error in facebookConnectController:', error?.response?.data || error?.message);
    next(error)
  }
}