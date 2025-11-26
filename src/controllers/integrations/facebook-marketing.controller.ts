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


export async function getAdsStatisticsController(
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
      .select("metadata config");

    if (!integration) {
      return next(
        new CustomError(
          "Facebook integration not found for this business",
          HttpStatusCode.NotFound
        )
      );
    }

    const adAccountId: string | undefined = integration.metadata?.adAccountId;
    const userAccessToken: string | undefined = integration.metadata?.userAccessToken;

    if (!adAccountId) {
      return next(
        new CustomError(
          "No ad account selected for this business",
          HttpStatusCode.BadRequest
        )
      );
    }
    if (!userAccessToken) {
      return next(
        new CustomError(
          "No user access token available to query insights",
          HttpStatusCode.BadRequest
        )
      );
    }

    const q = req.query as Record<string, any>;
    const level = typeof q.level === "string" ? q.level.toLowerCase() : undefined;
    const fields = typeof q.fields === "string" && q.fields.trim()
      ? q.fields.split(",").map((f: string) => f.trim()).filter(Boolean)
      : undefined;
    const date_preset = typeof q.date_preset === "string" ? q.date_preset : undefined;
    const since = typeof q.since === "string" ? q.since : undefined;
    const until = typeof q.until === "string" ? q.until : undefined;
    const filtering = typeof q.filtering === "string" && q.filtering.trim()
      ? JSON.parse(q.filtering)
      : undefined;
    const sort = typeof q.sort === "string" ? q.sort : undefined;
    const actionWindows = typeof q.action_attribution_windows === "string" && q.action_attribution_windows.trim()
      ? JSON.parse(q.action_attribution_windows)
      : undefined;

    const statistics = await facebookMarketingService.getAdsStatistics(
      adAccountId,
      userAccessToken,
      {
        level: level as any,
        fields,
        date_preset,
        since,
        until,
        filtering,
        sort,
        action_attribution_windows: actionWindows,
      }
    );

    res.status(HttpStatusCode.Ok).send({
      message: "Ad statistics retrieved successfully",
      statistics,
    });
    return;
  } catch (error: any) {
    next(error);
  }
}

export async function getAdsWithLinksAndMetricsController(
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
      .select("metadata config");

    if (!integration) {
      return next(
        new CustomError(
          "Facebook integration not found for this business",
          HttpStatusCode.NotFound
        )
      );
    }

    const adAccountId: string | undefined = integration.metadata?.adAccountId;
    const userAccessToken: string | undefined = integration.metadata?.userAccessToken;

    if (!adAccountId) {
      return next(
        new CustomError(
          "No ad account selected for this business",
          HttpStatusCode.BadRequest
        )
      );
    }
    if (!userAccessToken) {
      return next(
        new CustomError(
          "No user access token available to query ads",
          HttpStatusCode.BadRequest
        )
      );
    }

    const q = req.query as Record<string, any>;
    const limit = q.limit !== undefined ? Number(q.limit) : undefined;
    const after = typeof q.after === "string" ? q.after : undefined;
    const date_preset = typeof q.date_preset === "string" ? q.date_preset : undefined;
    const since = typeof q.since === "string" ? q.since : undefined;
    const until = typeof q.until === "string" ? q.until : undefined;
    const filtering = typeof q.filtering === "string" && q.filtering.trim()
      ? JSON.parse(q.filtering)
      : undefined;

    const ads = await facebookMarketingService.getAdsWithLinksAndMetrics(
      adAccountId,
      userAccessToken,
      { limit, after, date_preset, since, until, filtering }
    );

    res.status(HttpStatusCode.Ok).send({
      message: "Ads with links and metrics retrieved successfully",
      ads
    });
    return;
  } catch (error: any) {
    next(error);
  }
}

export async function getTopAdController(
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
      .select("metadata config");

    if (!integration) {
      return next(
        new CustomError(
          "Facebook integration not found for this business",
          HttpStatusCode.NotFound
        )
      );
    }

    const adAccountId: string | undefined = integration.metadata?.adAccountId;
    const userAccessToken: string | undefined = integration.metadata?.userAccessToken;

    if (!adAccountId) {
      return next(
        new CustomError(
          "No ad account selected for this business",
          HttpStatusCode.BadRequest
        )
      );
    }
    if (!userAccessToken) {
      return next(
        new CustomError(
          "No user access token available to query top ad",
          HttpStatusCode.BadRequest
        )
      );
    }

    const q = req.query as Record<string, any>;
    const by = typeof q.by === "string" ? q.by : undefined;
    const date_preset = typeof q.date_preset === "string" ? q.date_preset : undefined;
    const since = typeof q.since === "string" ? q.since : undefined;
    const until = typeof q.until === "string" ? q.until : undefined;
    const status = typeof q.status === "string" && q.status.trim()
      ? q.status.split(",").map((s: string) => s.trim()).filter(Boolean)
      : undefined;
    const limit = q.limit !== undefined ? Number(q.limit) : 3;

    const topAds = await facebookMarketingService.getTopAdsWithLinksAndMetrics(
      adAccountId,
      userAccessToken,
      { by: by as any, date_preset, since, until, status, limit }
    );

    if (!topAds || topAds.length === 0) {
      res.status(HttpStatusCode.Ok).send({
        message: "No active ads found for the specified criteria",
        ads: []
      });
      return;
    }

    res.status(HttpStatusCode.Ok).send({
      message: `Top ${topAds.length} ads retrieved successfully`,
      ads: topAds
    });
    return;
  } catch (error: any) {
    next(error);
  }
}
