import { Request, Response, NextFunction } from "express";
import { HttpStatusCode } from "axios";
import { Types } from "mongoose";
import CustomError from "../../errors/customError.error";
import models from "../../models";
import {
  facebookMarketingService,
} from "../../services/facebookMarketing.service";
import { facebookService } from "../../services/facebook.service";

export async function listAdAccountsController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { businessId } = req.params;
    if (!businessId || !Types.ObjectId.isValid(businessId)) {
      return next(
        new CustomError(
          "Invalid or missing businessId parameter",
          HttpStatusCode.BadRequest
        )
      );
    }

    const integration = await models.integration
      .findOne({ business: businessId, type: "facebook" })
      .select("+config.accessToken metadata");

    if (!integration) {
      return next(
        new CustomError(
          "Facebook integration not found for this business",
          HttpStatusCode.NotFound
        )
      );
    }

    const userAccessToken = integration.metadata?.userAccessToken;

    if (!userAccessToken) {
      return next(
        new CustomError(
          "No user access token available to list ad accounts. Please reconnect Facebook and ensure ads permissions.",
          HttpStatusCode.BadRequest
        )
      );
    }

    let accounts;
    try {
      accounts = await facebookService.getAdAccounts(userAccessToken);
    } catch (err: any) {
      const msg: string = err?.response?.data?.error?.message || "";
      const code: number = err?.response?.data?.error?.code;
      const type: string = err?.response?.data?.error?.type;
      if (
        type === "OAuthException" &&
        code === 100 &&
        msg.includes("nonexisting field (adaccounts) on node type (Page)")
      ) {
        return next(
          new CustomError(
            "Provided token belongs to a Page. Use a User access token with ads_management permissions to list ad accounts.",
            HttpStatusCode.BadRequest
          )
        );
      }
      throw err;
    }

    return res.status(HttpStatusCode.Ok).send({
      message: `Found ${accounts.length} ad accounts`,
      accounts,
    });
  } catch (error: any) {
    console.error(error)
    next(error);
  }
}

export async function saveAdAccountController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { businessId } = req.params;
    const { adAccountId } = req.body as { adAccountId?: string };

    if (!businessId || !Types.ObjectId.isValid(businessId)) {
      return next(
        new CustomError(
          "Invalid or missing businessId parameter",
          HttpStatusCode.BadRequest
        )
      );
    }

    if (!adAccountId || typeof adAccountId !== "string") {
      return next(
        new CustomError(
          "Missing required body field: adAccountId",
          HttpStatusCode.BadRequest
        )
      );
    }

    const normalized = adAccountId.startsWith("act_")
      ? adAccountId.replace(/^act_/, "")
      : adAccountId;

    if (!/^\d{6,}$/.test(normalized)) {
      return next(
        new CustomError(
          "Invalid adAccountId format",
          HttpStatusCode.BadRequest
        )
      );
    }

    const integration = await models.integration.saveAdAccountId(
      businessId,
      normalized
    );

    if (!integration) {
      return next(
        new CustomError(
          "Facebook integration not found for this business",
          HttpStatusCode.NotFound
        )
      );
    }

    await models.business.updateOne({ _id: businessId }, { $addToSet: { integrations: integration._id } });

    res.status(HttpStatusCode.Ok).send({
      message: "Ad account saved successfully",
      adAccountId: normalized,
    });
    return;
  } catch (error: any) {
    next(error);
  }
}

export async function saveUserAccessTokenController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { businessId } = req.params;
    const { accessToken } = req.body as { accessToken?: string };

    if (!businessId || !Types.ObjectId.isValid(businessId)) {
      return next(
        new CustomError(
          "Invalid or missing businessId parameter",
          HttpStatusCode.BadRequest
        )
      );
    }

    if (!accessToken) {
      return next(
        new CustomError(
          "Missing required body field: accessToken",
          HttpStatusCode.BadRequest
        )
      );
    }

    const exchange = await facebookMarketingService['config']
      ? await (await import("../../services/facebook.service")).facebookService.exchangeLongLivedUserAccessToken(accessToken)
      : await (await import("../../services/facebook.service")).facebookService.exchangeLongLivedUserAccessToken(accessToken);

    const integration = await models.integration.saveUserAccessToken(
      businessId,
      exchange.access_token,
      exchange.expires_in
    );

    if (!integration) {
      return next(
        new CustomError(
          "Facebook integration not found for this business",
          HttpStatusCode.NotFound
        )
      );
    }

    await models.business.updateOne({ _id: businessId }, { $addToSet: { integrations: integration._id } });

    res.status(HttpStatusCode.Ok).send({
      message: "User access token saved successfully",
      expiresIn: exchange.expires_in,
    });
    return;
  } catch (error: any) {
    next(error);
  }
}
