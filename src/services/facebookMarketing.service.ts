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

  async getAdsStatistics(
    adAccountId: string,
    userAccessToken: string,
    options?: {
      level?: "account" | "campaign" | "adset" | "ad";
      fields?: string[];
      date_preset?: string;
      since?: string;
      until?: string;
      filtering?: any;
      sort?: string;
      action_attribution_windows?: string[];
    }
  ): Promise<any[]> {
    const url = this.graphUrl(`/act_${adAccountId}/insights`);
    const params: Record<string, any> = {
      access_token: userAccessToken,
    };
    if (options?.fields && options.fields.length > 0) {
      params.fields = options.fields.join(",");
    } else {
      params.fields = [
        "impressions",
        "reach",
        "spend",
        "clicks",
        "cpm",
        "ctr",
        "actions",
        "cost_per_action_type",
        "date_start",
        "date_stop",
      ].join(",");
    }
    if (options?.level) params.level = options.level;
    if (options?.date_preset) params.date_preset = options.date_preset;
    if (options?.since || options?.until) {
      params.time_range = JSON.stringify({
        since: options?.since,
        until: options?.until,
      });
    }
    if (options?.filtering) params.filtering = JSON.stringify(options.filtering);
    if (options?.sort) params.sort = options.sort;
    if (options?.action_attribution_windows && options.action_attribution_windows.length > 0) {
      params.action_attribution_windows = JSON.stringify(options.action_attribution_windows);
    }

    const { data } = await axios.get<{ data: any[] }>(url, { params });
    return data.data || [];
  }

  async getAdsWithLinksAndMetrics(
    adAccountId: string,
    userAccessToken: string,
    options?: {
      limit?: number;
      after?: string;
      date_preset?: string;
      since?: string;
      until?: string;
      filtering?: any;
    }
  ): Promise<any[]> {
    const url = this.graphUrl(`/act_${adAccountId}/ads`);
    const params: Record<string, any> = {
      access_token: userAccessToken,
      fields: [
        'id',
        'name',
        'adset_id',
        'campaign_id',
        'creative{effective_object_story_id,object_story_id,thumbnail_url,object_story_spec{link_data{link,call_to_action{type},picture},video_data{video_id}}}',
        'insights{impressions,reach,spend,clicks,cpm,ctr,actions,cost_per_action_type,date_start,date_stop,inline_link_clicks}'
      ].join(',')
    };
    if (options?.limit) params.limit = options.limit;
    if (options?.after) params.after = options.after;
    if (options?.date_preset) params.date_preset = options.date_preset;
    if (options?.since || options?.until) {
      params.time_range = JSON.stringify({ since: options?.since, until: options?.until });
    }
    if (options?.filtering) params.filtering = JSON.stringify(options.filtering);

    const { data } = await axios.get<{ data: any[] }>(url, { params });
    const ads = Array.isArray(data?.data) ? data.data : [];

    const storyIds: string[] = ads
      .map((a: any) => a?.creative?.effective_object_story_id || a?.creative?.object_story_id)
      .filter((v: any) => typeof v === 'string');

    const videoIds: string[] = ads
      .map((a: any) => a?.creative?.object_story_spec?.video_data?.video_id)
      .filter((v: any) => typeof v === 'string');

    const idsToResolve = Array.from(new Set<string>([...storyIds, ...videoIds]));
    const permalinks = await this.getPermalinksForStoryIds(idsToResolve, userAccessToken);

    return ads.map((ad: any) => {
      const storyId = ad?.creative?.effective_object_story_id || ad?.creative?.object_story_id;
      const videoId = ad?.creative?.object_story_spec?.video_data?.video_id;
      const linkData = ad?.creative?.object_story_spec?.link_data;
      const permalinkEntry = (storyId && permalinks.get(String(storyId))) || (videoId && permalinks.get(String(videoId))) || undefined;
      const permalinkUrl = (permalinkEntry && permalinkEntry.permalink_url) || this.buildFallbackPermalink(storyId || videoId);
      const instagramPermalinkUrl = permalinkEntry?.instagram_permalink_url;
      return {
        id: ad?.id,
        name: ad?.name,
        links: {
          landingPage: linkData?.link,
          permalinkUrl,
          instagramPermalinkUrl
        },
        preview: {
          thumbnailUrl: ad?.creative?.thumbnail_url,
          pictureUrl: linkData?.picture
        },
        metrics: Array.isArray(ad?.insights?.data) && ad.insights.data.length > 0 ? ad.insights.data[0] : {},
        adsetId: ad?.adset_id,
        campaignId: ad?.campaign_id
      };
    });
  }

  private async getPermalinksForStoryIds(
    storyIds: string[],
    accessToken: string
  ): Promise<Map<string, { permalink_url?: string; instagram_permalink_url?: string }>> {
    if (!storyIds.length) return new Map();
    const batchRequests = storyIds.map((id) => ({
      method: 'GET',
      relative_url: `${this.config.apiVersion}/${id}?fields=permalink_url,instagram_permalink_url`
    }));
    const url = `https://graph.facebook.com/`;
    const params = {
      access_token: accessToken,
      batch: JSON.stringify(batchRequests)
    };
    const response = await axios.post<any[]>(url, null, { params });
    const map = new Map<string, { permalink_url?: string; instagram_permalink_url?: string }>();
    response.data.forEach((result, index) => {
      const id = storyIds[index];
      if (result && result.code === 200) {
        const body = JSON.parse(result.body);
        map.set(id, {
          permalink_url: body?.permalink_url,
          instagram_permalink_url: body?.instagram_permalink_url
        });
      } else {
        map.set(id, {});
      }
    });
    return map;
  }

  private buildFallbackPermalink(id?: string): string | undefined {
    if (!id) return undefined;
    if (id.includes('_')) {
      const parts = id.split('_');
      const postId = parts[1];
      if (postId) return `https://www.facebook.com/${postId}`;
    }
    if (/^\d+$/.test(id)) {
      return `https://www.facebook.com/watch/?v=${id}`;
    }
    return undefined;
  }

  async getTopAdWithLinksAndMetrics(
    adAccountId: string,
    userAccessToken: string,
    options?: {
      by?: 'reach' | 'spend' | 'ctr' | 'clicks' | 'impressions';
      status?: string[];
      date_preset?: string;
      since?: string;
      until?: string;
    }
  ): Promise<any | null> {
    const url = this.graphUrl(`/act_${adAccountId}/insights`);
    const sortField = options?.by || 'reach';
    const params: Record<string, any> = {
      access_token: userAccessToken,
      level: 'ad',
      sort: `${sortField}_descending`,
      fields: [
        'ad_id',
        'ad_name',
        'impressions',
        'reach',
        'spend',
        'clicks',
        'cpm',
        'ctr',
        'actions',
        'cost_per_action_type',
        'date_start',
        'date_stop'
      ].join(',')
    };
    if (options?.date_preset) params.date_preset = options.date_preset;
    if (options?.since || options?.until) {
      params.time_range = JSON.stringify({ since: options?.since, until: options?.until });
    }
    const statuses = options?.status && options.status.length ? options.status : ['ACTIVE'];
    params.filtering = JSON.stringify([{ field: 'ad.effective_status', operator: 'IN', value: statuses }]);

    const insightsResp = await axios.get<{ data: any[] }>(url, { params });
    const first = Array.isArray(insightsResp.data?.data) && insightsResp.data.data.length > 0 ? insightsResp.data.data[0] : null;
    if (!first) return null;

    const adId = String(first.ad_id);
    const adDetailUrl = this.graphUrl(`/${adId}`);
    const adDetailParams = {
      access_token: userAccessToken,
      fields: [
        'id',
        'name',
        'adset_id',
        'campaign_id',
        'creative{effective_object_story_id,object_story_id,thumbnail_url,object_story_spec{link_data{link,call_to_action{type},picture},video_data{video_id}}}'
      ].join(',')
    };
    const adDetailResp = await axios.get<any>(adDetailUrl, { params: adDetailParams });
    const detail = adDetailResp.data || {};
    const storyId = detail?.creative?.effective_object_story_id || detail?.creative?.object_story_id;
    const videoId = detail?.creative?.object_story_spec?.video_data?.video_id;
    const idsToResolve = (storyId || videoId) ? [storyId, videoId].filter(Boolean) as string[] : [];
    const permalinks = await this.getPermalinksForStoryIds(idsToResolve, userAccessToken);
    const permalinkEntry = (storyId && permalinks.get(String(storyId))) || (videoId && permalinks.get(String(videoId))) || undefined;

    return {
      id: adId,
      name: detail?.name || first?.ad_name,
      links: {
        landingPage: detail?.creative?.object_story_spec?.link_data?.link,
        permalinkUrl: (permalinkEntry && permalinkEntry.permalink_url) || this.buildFallbackPermalink(storyId || videoId),
        instagramPermalinkUrl: permalinkEntry?.instagram_permalink_url
      },
      preview: {
        thumbnailUrl: detail?.creative?.thumbnail_url,
        pictureUrl: detail?.creative?.object_story_spec?.link_data?.picture
      },
      metrics: first,
      adsetId: detail?.adset_id,
      campaignId: detail?.campaign_id
    };
  }

  async getTopAdsWithLinksAndMetrics(
    adAccountId: string,
    userAccessToken: string,
    options?: {
      by?: 'reach' | 'spend' | 'ctr' | 'clicks' | 'impressions';
      status?: string[];
      date_preset?: string;
      since?: string;
      until?: string;
      limit?: number;
    }
  ): Promise<any[]> {
    const url = this.graphUrl(`/act_${adAccountId}/insights`);
    const sortField = options?.by || 'reach';
    const limit = typeof options?.limit === 'number' && options?.limit > 0 ? options!.limit : 3;
    const params: Record<string, any> = {
      access_token: userAccessToken,
      level: 'ad',
      sort: `${sortField}_descending`,
      fields: [
        'ad_id',
        'ad_name',
        'impressions',
        'reach',
        'spend',
        'clicks',
        'cpm',
        'ctr',
        'actions',
        'cost_per_action_type',
        'date_start',
        'date_stop'
      ].join(','),
      limit
    };
    if (options?.date_preset) params.date_preset = options.date_preset;
    if (options?.since || options?.until) {
      params.time_range = JSON.stringify({ since: options?.since, until: options?.until });
    }
    const statuses = options?.status && options.status.length ? options.status : ['ACTIVE'];
    params.filtering = JSON.stringify([{ field: 'ad.effective_status', operator: 'IN', value: statuses }]);

    const insightsResp = await axios.get<{ data: any[] }>(url, { params });
    const rows = Array.isArray(insightsResp.data?.data) ? insightsResp.data.data.slice(0, limit) : [];
    if (!rows.length) return [];

    const adIds = rows.map(r => String(r.ad_id));
    const batchRequests: any[] = [];
    for (const id of adIds) {
      batchRequests.push({
        method: 'GET',
        relative_url: `/${id}?fields=${[
          'id',
          'name',
          'adset_id',
          'campaign_id',
          'creative{effective_object_story_id,object_story_id,thumbnail_url,object_story_spec{link_data{link,call_to_action{type},picture},video_data{video_id}}}'
        ].join(',')}`
      });
      let insightsQuery = `fields=${[
        'impressions', 'reach', 'spend', 'clicks', 'ctr', 'cpm', 'actions', 'cost_per_action_type', 'date_start', 'date_stop'
      ].join(',')}&breakdowns=publisher_platform`;
      if (options?.date_preset) insightsQuery += `&date_preset=${options.date_preset}`;
      if (options?.since || options?.until) {
        const timeRange = JSON.stringify({ since: options?.since, until: options?.until });
        insightsQuery += `&time_range=${timeRange}`;
      }
      batchRequests.push({
        method: 'GET',
        relative_url: `/${id}/insights?${insightsQuery}`
      });
    }
    const batchUrl = `https://graph.facebook.com/${this.config.apiVersion}`;
    const batchParams = { access_token: userAccessToken, batch: JSON.stringify(batchRequests) };
    const batchResp = await axios.post<any[]>(batchUrl, null, { params: batchParams });
    const batchData = Array.isArray(batchResp.data) ? batchResp.data : [];
    const details: any[] = [];
    const breakdowns: any[] = [];
    for (let i = 0; i < adIds.length; i++) {
      const detailsResult = batchData[i * 2];
      const insightsResult = batchData[i * 2 + 1];
      details.push((detailsResult && detailsResult.code === 200) ? JSON.parse(detailsResult.body) : {});
      breakdowns.push((insightsResult && insightsResult.code === 200) ? JSON.parse(insightsResult.body) : {});
    }

    const storyIds: string[] = [];
    const videoIds: string[] = [];
    for (const d of details) {
      const sid = d?.creative?.effective_object_story_id || d?.creative?.object_story_id;
      const vid = d?.creative?.object_story_spec?.video_data?.video_id;
      if (typeof sid === 'string') storyIds.push(String(sid));
      if (typeof vid === 'string') videoIds.push(String(vid));
    }
    const idsToResolve = Array.from(new Set<string>([...storyIds, ...videoIds]));
    const permalinks = await this.getPermalinksForStoryIds(idsToResolve, userAccessToken);

    const results: any[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const detail = details[i] || {};
      const breakdownData = breakdowns[i]?.data;
      const sid = detail?.creative?.effective_object_story_id || detail?.creative?.object_story_id;
      const vid = detail?.creative?.object_story_spec?.video_data?.video_id;
      const linkData = detail?.creative?.object_story_spec?.link_data;
      const pEntry = (sid && permalinks.get(String(sid))) || (vid && permalinks.get(String(vid))) || undefined;
      const permalinkUrl = (pEntry && pEntry.permalink_url) || this.buildFallbackPermalink(sid || vid);
      const instagramPermalinkUrl = pEntry?.instagram_permalink_url;
      results.push({
        id: String(row.ad_id),
        name: detail?.name || row?.ad_name,
        links: {
          landingPage: linkData?.link,
          permalinkUrl,
          instagramPermalinkUrl
        },
        preview: {
          thumbnailUrl: detail?.creative?.thumbnail_url,
          pictureUrl: linkData?.picture
        },
        metrics: row,
        platformBreakdown: Array.isArray(breakdownData) ? breakdownData : [],
        adsetId: detail?.adset_id,
        campaignId: detail?.campaign_id
      });
    }

    return results;
  }
}

export const facebookMarketingService = new FacebookMarketingService();
