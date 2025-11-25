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

}

export const facebookMarketingService = new FacebookMarketingService();
