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
}

// Instancia por defecto usando variables de entorno o valores proporcionados
export const facebookService = new FacebookService();