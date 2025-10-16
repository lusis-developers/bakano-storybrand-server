import axios from 'axios';

export interface ExchangeTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in: number;
}

export interface FacebookServiceConfig {
  apiVersion: string;
  appId: string;
  appSecret: string;
}

export interface PageInfo {
  id: string;
  name: string;
  access_token: string;
  category: string;
  tasks: string[];
  picture: {
    data: {
      url: string;
    }
  }
}

export interface PagePost {
  id: string;
  created_time: string;
  message?: string;
  full_picture?: string;
  permalink_url: string;
}

export class FacebookService {
  private readonly config: FacebookServiceConfig;

  constructor(config?: Partial<FacebookServiceConfig>) {
    const defaults: FacebookServiceConfig = {
      apiVersion: process.env.FACEBOOK_API_VERSION || 'v23.0',
      appId: process.env.FACEBOOK_APP_ID || '0',
      appSecret: process.env.FACEBOOK_APP_SECRET || '0',
    };

    this.config = { ...defaults, ...(config || {}) } as FacebookServiceConfig;
    console.log('[FacebookService] Inicializado con configuración:', {
      apiVersion: this.config.apiVersion,
      appId: this.config.appId,
      // Nunca loguear el secreto completo
      appSecret: `${this.config.appSecret.slice(0, 6)}...`,
    });
  }

  private graphUrl(path: string): string {
    return `https://graph.facebook.com/${this.config.apiVersion}${path}`;
  }

  /**
   * Intercambia un token de acceso corto (usuario) por uno de larga duración.
   * Docs: https://developers.facebook.com/docs/facebook-login/access-tokens/refreshing/
   */
  async exchangeLongLivedUserAccessToken(shortLivedAccessToken: string): Promise<ExchangeTokenResponse> {
    console.log('[FacebookService] Iniciando intercambio de token corto por largo...');
    const url = this.graphUrl('/oauth/access_token');
    const params = {
      grant_type: 'fb_exchange_token',
      client_id: this.config.appId,
      client_secret: this.config.appSecret,
      fb_exchange_token: shortLivedAccessToken,
    };

    console.log('[FacebookService] URL de intercambio:', url);
    console.log('[FacebookService] Parámetros:', {
      grant_type: params.grant_type,
      client_id: params.client_id,
      client_secret: `${params.client_secret.slice(0, 6)}...`,
      fb_exchange_token: `${shortLivedAccessToken.slice(0, 8)}...`,
    });

    try {
      const response = await axios.get<ExchangeTokenResponse>(url, { params });
      console.log('[FacebookService] Respuesta del intercambio:', {
        access_token: `${response.data.access_token.slice(0, 12)}...`,
        expires_in: response.data.expires_in,
        token_type: response.data.token_type,
      });
      return response.data;
    } catch (error: any) {
      const fbError = error?.response?.data || error?.message;
      console.error('[FacebookService] Error en el intercambio de token:', fbError);
      throw new Error(error?.response?.data?.error?.message || 'Error al intercambiar token en Facebook');
    }
  }

  async getUserPages(userAccessToken: string): Promise<PageInfo[]> {
    console.log('[FacebookService] obteniendo pagina del usuario...');
    const url  = this.graphUrl('/me/accounts');

    const params = {
      fields: 'id,name,access_token,category,tasks,picture{url}',
      access_token: userAccessToken,
    }

    try {
      const response = await axios.get<({data: PageInfo[]})>(url, {params})
      return response.data.data;
    } catch (error: any) {
      const fbError = error?.response?.data || error?.message;
      console.error('[FacebookService] Error en el intercambio de token:', fbError);
      throw new Error(error?.response?.data?.error?.message || 'Error al obtener paginas en Facebook');
    }
  }


  async getPagePosts(pageAccessToken: string, pageId: string, limit: number = 10): Promise<PagePost[]> {
    console.log(`[FacebookService] Obteniendo las últimas ${limit} publicaciones de la página ${pageId}...`);
    const url = this.graphUrl(`/${pageId}/posts`);
    const params = {
      fields: 'id,created_time,message,full_picture,permalink_url',
      limit,
      access_token: pageAccessToken,
    };

    try {
      const response = await axios.get<{ data: PagePost[] }>(url, { params });
      console.log(`[FacebookService] ✅ Se obtuvieron ${response.data.data.length} publicaciones.`);
      return response.data.data;
    } catch (error: any) {
      const fbError = error?.response?.data || error?.message;
      console.error(`[FacebookService] Error al obtener las publicaciones de la página ${pageId}:`, fbError);
      throw new Error(error?.response?.data?.error?.message || 'Error al obtener las publicaciones de Facebook');
    }
  }
}

export const facebookService = new FacebookService();