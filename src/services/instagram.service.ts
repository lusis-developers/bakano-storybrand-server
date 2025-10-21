import axios from 'axios';

export interface InstagramMediaItem {
  id: string;
  caption?: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  media_url?: string;
  permalink: string;
  thumbnail_url?: string;
  timestamp: string;
  children?: {
    data: Array<{
      id: string;
      media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
      media_url?: string;
      thumbnail_url?: string;
    }>
  };
}

export interface InstagramAccountStats {
  username: string;
  follower_count: number;
  impressions: number;
  reach: number;
  profile_views: number;
  period: {
    since: string;
    until: string;
    days: number;
  };
}

export class InstagramService {
  private readonly apiBase = 'https://graph.facebook.com';
  private readonly apiVersion = process.env.FACEBOOK_API_VERSION || 'v24.0';

  /**
   * Fetch latest media for an Instagram Business account (igUserId)
   */
  async getUserMedia(igUserId: string, accessToken: string, limit: number = 10): Promise<InstagramMediaItem[]> {
    const fields = [
      'id',
      'caption',
      'media_type',
      'media_url',
      'permalink',
      'thumbnail_url',
      'timestamp',
      'children.limit(10){id,media_type,media_url,thumbnail_url}'
    ].join(',');

    const url = `${this.apiBase}/${this.apiVersion}/${igUserId}/media`;

    const { data } = await axios.get(url, {
      params: {
        fields,
        access_token: accessToken,
        limit
      }
    });

    return data?.data || [];
  }
}

const instagramService = new InstagramService();
export default instagramService;
export { instagramService };