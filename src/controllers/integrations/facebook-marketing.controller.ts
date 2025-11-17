import { Request, Response, NextFunction } from "express";
import { HttpStatusCode } from "axios";
import { Types } from "mongoose";
import CustomError from "../../errors/customError.error";
import models from "../../models";
import {
  facebookMarketingService,
  CreateCampaignParams,
  CreateAdSetParams,
  CreateAdCreativeParams,
  CreateAdParams,
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

    res.status(HttpStatusCode.Ok).send({
      message: "User access token saved successfully",
      expiresIn: exchange.expires_in,
    });
    return;
  } catch (error: any) {
    next(error);
  }
}

export async function orchestrateCampaignController(
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

    const {
      adAccountId,
      campaign,
      adset,
      creative,
      ad,
    }: {
      adAccountId?: string;
      campaign: CreateCampaignParams & { status?: string };
      adset: CreateAdSetParams;
      creative: CreateAdCreativeParams;
      ad: Omit<CreateAdParams, "adset_id" | "creative"> & {
        status?: "ACTIVE" | "PAUSED";
      };
    } = req.body || {};

    const integration = await models.integration
      .findOne({ business: businessId, type: "facebook", isConnected: true })
      .select("+config.accessToken metadata");

    if (!integration) {
      return next(
        new CustomError(
          "Active Facebook integration not found for this business",
          HttpStatusCode.NotFound
        )
      );
    }

    const userAccessToken = integration.metadata?.userAccessToken;
    if (!userAccessToken) {
      return next(
        new CustomError(
          "No user access token available to manage ads. Reconnect and grant ads permissions.",
          HttpStatusCode.BadRequest
        )
      );
    }

    const selectedAdAccountId = adAccountId || integration.metadata?.adAccountId;
    if (!selectedAdAccountId) {
      return next(
        new CustomError(
          "Missing adAccountId. Provide it in body or save it in integration metadata.",
          HttpStatusCode.BadRequest
        )
      );
    }

    const result = await facebookMarketingService.orchestrateCampaign(
      selectedAdAccountId,
      { campaign, adset, creative, ad: { name: ad?.name, status: ad?.status } },
      userAccessToken
    );

    return res.status(HttpStatusCode.Created).send({
      message: "Marketing campaign orchestrated successfully",
      adAccountId: selectedAdAccountId,
      campaign: result.campaign,
      adset: result.adset,
      creative: result.creative,
      ad: result.ad,
    });
  } catch (error: any) {
    console.error('errorsote: ', error.response.data || 'no existe esto')
    const fbErr = error?.response?.data?.error || error?.meta;
    if (fbErr) {
      const payload = {
        message: fbErr?.message || "Request failed",
        type: fbErr?.type,
        code: fbErr?.code,
        error_subcode: fbErr?.error_subcode,
        error_user_title: fbErr?.error_user_title,
        error_user_msg: fbErr?.error_user_msg,
        fbtrace_id: fbErr?.fbtrace_id,
      };
      res.status(HttpStatusCode.BadRequest).send(payload);
      return;
    }
    res.status(HttpStatusCode.InternalServerError).send({ message: "Unexpected error orchestrating campaign." });
    return;
  }
}

