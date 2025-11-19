import axios from "axios";

export interface FacebookMarketingConfig {
  apiVersion: string;
}

export interface AdAccountSummary {
  id: string;
  account_id: string;
  name?: string;
  currency?: string;
}

export interface CreateCampaignParams {
  name: string;
  objective: string;
  status?: "PAUSED" | "ACTIVE" | "ARCHIVED";
  special_ad_categories?: string[];
}

export interface CreateAdSetParams {
  name: string;
  campaign_id: string;
  daily_budget: number;
  targeting: Record<string, any>;
  is_adset_budget_sharing_enabled?: boolean;
}

export interface ObjectStorySpecLinkDataCTA {
  type: string;
}

export interface ObjectStorySpecLinkData {
  message: string;
  link: string;
  caption?: string;
  picture?: string;
  call_to_action?: ObjectStorySpecLinkDataCTA;
}

export interface ObjectStorySpec {
  page_id: string;
  link_data: ObjectStorySpecLinkData;
}

export interface CreateAdCreativeParams {
  name: string;
  object_story_spec: ObjectStorySpec;
}

export interface CreateAdParams {
  name: string;
  adset_id: string;
  creative: { creative_id: string };
  status?: "ACTIVE" | "PAUSED";
}

export class FacebookMarketingService {
  private readonly config: FacebookMarketingConfig;

  constructor(config?: Partial<FacebookMarketingConfig>) {
    const defaults: FacebookMarketingConfig = {
      apiVersion: process.env.FACEBOOK_API_VERSION || "v24.0",
    };
    this.config = { ...defaults, ...(config || {}) } as FacebookMarketingConfig;
  }

  private graphUrl(path: string): string {
    return `https://graph.facebook.com/${this.config.apiVersion}${
      path.startsWith("/") ? path : "/" + path
    }`;
  }

  async getAdAccounts(userAccessToken: string): Promise<AdAccountSummary[]> {
    const url = this.graphUrl("/me/adaccounts");
    const params = {
      fields: "id,account_id,name,currency",
      access_token: userAccessToken,
    };
    const { data } = await axios.get<{ data: AdAccountSummary[] }>(url, {
      params,
    });
    return data.data;
  }

  async createCampaign(
    adAccountId: string,
    paramsIn: CreateCampaignParams,
    accessToken: string
  ): Promise<{ id: string }> {
    const url = this.graphUrl(`/act_${adAccountId}/campaigns`);
    const params = {
      ...paramsIn,
      special_ad_categories: paramsIn.special_ad_categories ?? ["NONE"],
      access_token: accessToken,
    };
    const { data } = await axios.post<{ id: string }>(url, null, { params });
    return data;
  }

  async createAdSet(
    adAccountId: string,
    paramsIn: CreateAdSetParams,
    accessToken: string
  ): Promise<{ id: string }> {
    const url = this.graphUrl(`/act_${adAccountId}/adsets`);
    const params = {
      ...paramsIn,
      targeting: JSON.stringify(paramsIn.targeting),
      is_adset_budget_sharing_enabled: paramsIn.is_adset_budget_sharing_enabled ?? false,
      access_token: accessToken,
    };
    const { data } = await axios.post<{ id: string }>(url, null, { params });
    return data;
  }

  async createAdCreative(
    adAccountId: string,
    paramsIn: CreateAdCreativeParams,
    accessToken: string
  ): Promise<{ id: string }> {
    const url = this.graphUrl(`/act_${adAccountId}/adcreatives`);
    const params = {
      ...paramsIn,
      object_story_spec: JSON.stringify(paramsIn.object_story_spec),
      access_token: accessToken,
    };
    const { data } = await axios.post<{ id: string }>(url, null, { params });
    return data;
  }

  async createAd(
    adAccountId: string,
    paramsIn: CreateAdParams,
    accessToken: string
  ): Promise<{ id: string }> {
    const url = this.graphUrl(`/act_${adAccountId}/ads`);
    const params = {
      ...paramsIn,
      creative: JSON.stringify(paramsIn.creative),
      access_token: accessToken,
    };
    const { data } = await axios.post<{ id: string }>(url, null, { params });
    return data;
  }

  async orchestrateCampaign(
    adAccountId: string,
    payload: {
      campaign: CreateCampaignParams & { status?: string };
      adset: CreateAdSetParams;
      creative: CreateAdCreativeParams;
      ad: { name: string; status?: "ACTIVE" | "PAUSED" };
    },
    accessToken: string
  ): Promise<{
    campaign: { id: string };
    adset: { id: string };
    creative: { id: string };
    ad: { id: string };
  }> {
    try {
      const createdCampaign = await this.createCampaign(
        adAccountId,
        {
          name: payload.campaign.name,
          objective: payload.campaign.objective,
          status: (payload.campaign.status as any) || "PAUSED",
          special_ad_categories: payload.campaign.special_ad_categories ?? ["NONE"],
        },
        accessToken
      );

      const createdAdSet = await this.createAdSet(
        adAccountId,
        {
          name: payload.adset.name,
          campaign_id: createdCampaign.id,
          daily_budget: payload.adset.daily_budget,
          targeting: payload.adset.targeting,
          is_adset_budget_sharing_enabled: payload.adset.is_adset_budget_sharing_enabled ?? false,
        },
        accessToken
      );

      const createdCreative = await this.createAdCreative(
        adAccountId,
        {
          name: payload.creative.name,
          object_story_spec: payload.creative.object_story_spec,
        },
        accessToken
      );

      const createdAd = await this.createAd(
        adAccountId,
        {
          name: payload.ad.name,
          adset_id: createdAdSet.id,
          creative: { creative_id: createdCreative.id },
          status: payload.ad.status || "ACTIVE",
        },
        accessToken
      );

      return {
        campaign: createdCampaign,
        adset: createdAdSet,
        creative: createdCreative,
        ad: createdAd,
      };
    } catch (error: any) {
      const fbErr = error?.response?.data?.error;
      if (fbErr) {
        const err = new Error(fbErr?.message || "Facebook Marketing API error");
        (err as any).meta = {
          type: fbErr?.type,
          code: fbErr?.code,
          error_subcode: fbErr?.error_subcode,
          error_user_title: fbErr?.error_user_title,
          error_user_msg: fbErr?.error_user_msg,
          fbtrace_id: fbErr?.fbtrace_id,
        };
        throw err;
      }
      throw error;
    }
  }
}

export const facebookMarketingService = new FacebookMarketingService();
