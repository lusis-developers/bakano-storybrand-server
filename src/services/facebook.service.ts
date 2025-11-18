import axios from "axios";

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
		};
	};
}

export interface PagePost {
	id: string;
	created_time: string;
	message?: string;
	full_picture?: string;
	permalink_url: string;
}

export interface CreatePostPayload {
	message: string;
	link?: string;
	published?: boolean;
	scheduled_publish_time?: number | string; // Timestamp UNIX o string ISO 8601
}

export interface CreatePostResponse {
	id: string; // ID del post de texto/enlace
}

export interface CreatePhotoPayload {
	url: string; // URL pública de la imagen
	message?: string;
	published?: boolean;
	scheduled_publish_time?: number | string;
}

export interface CreatePhotoResponse {
	id: string; // ID del objeto 'photo'
	post_id: string; // ID de la publicación
}

// Interfaces para Carrusel
export interface UnpublishedPhotoPayload {
	url: string;
	message?: string;
}
export interface UnpublishedPhotoResponse {
	id: string; // Este es el media_fbid
}
export interface CarouselPostPayload {
	message?: string;
	attached_media: { media_fbid: string }[];
}

// Interfaces para Video (Publicación Inmediata)
export interface CreateVideoPayload {
	file_url: string; // URL pública del video
	description?: string;
	title?: string;
	published?: boolean;
	scheduled_publish_time?: number | string; // No usado para publicación inmediata
}
export interface CreateVideoResponse {
	id: string; // ID del video subido
}

// Interfaces para Programar Reels
export interface ScheduleReelPayload {
	file_url: string; // URL pública del video
	description?: string;
	title?: string;
	thumb_offset?: number;
	share_to_feed?: boolean;
	published?: false; // Requerido: debe ser false
	scheduled_publish_time: number; // Requerido: Timestamp UNIX (segundos)
}

export interface ScheduleReelResponse {
	id: string; // ID del video programado
}

export interface ScheduledPagePost {
  id: string;
  scheduled_publish_time: number; // UNIX timestamp
  message?: string;
  // Media y metadatos útiles para previsualizar el contenido programado
  full_picture?: string; // Para fotos/enlaces con imagen de preview
  attachments?: {
    data: Array<{
      type?: string; // ej. photo, video_inline, link, album
      url?: string; // URL del attachment (link/CTA)
      media?: {
        image?: { src: string; height: number; width: number };
        source?: string; // Para videos: URL del origen (cuando disponible)
      };
      target?: { id?: string; url?: string };
      subattachments?: { data: Array<any> };
    }>;
  };
  status_type?: string;
  is_published?: boolean;
  created_time?: string;
  // permalink_url generalmente no estará disponible hasta que se publique
}

export interface AdAccountInfo {
  id: string;
  name: string;
  account_id: string; // El ID numérico
  business?: {
    id: string;
    name: string;
  };
}
// --- FIN INTERFACES ---

export class FacebookService {
  private readonly config: FacebookServiceConfig;

	constructor(config?: Partial<FacebookServiceConfig>) {
		const defaults: FacebookServiceConfig = {
			apiVersion: process.env.FACEBOOK_API_VERSION || "v24.0", // Consistente v24.0
			appId: process.env.FACEBOOK_APP_ID || "0",
			appSecret: process.env.FACEBOOK_APP_SECRET || "0",
		};
		this.config = {
			...defaults,
			...(config || {}),
		} as FacebookServiceConfig;
	}

	// Helper para construir la URL base
	private graphUrl(path: string): string {
		return `https://graph.facebook.com/${this.config.apiVersion}${
			path.startsWith("/") ? path : "/" + path
		}`;
	}

	// --- MÉTODOS EXISTENTES ---
	async exchangeLongLivedUserAccessToken(
		shortLivedAccessToken: string
	): Promise<ExchangeTokenResponse> {
		const url = this.graphUrl("/oauth/access_token");
		const params = {
			grant_type: "fb_exchange_token",
			client_id: this.config.appId,
			client_secret: this.config.appSecret,
			fb_exchange_token: shortLivedAccessToken,
		};
		try {
			const response = await axios.get<ExchangeTokenResponse>(url, {
				params,
			});
			return response.data;
		} catch (error: any) {
			const fbError = error?.response?.data?.error;
			console.error(
				"[FacebookService] ❌ Error intercambiando token:",
				fbError || error.message
			);
			throw new Error(fbError?.message || "Error al intercambiar token");
		}
	}

	async getUserPages(userAccessToken: string): Promise<PageInfo[]> {
		const url = this.graphUrl("/me/accounts");
		const params = {
			fields: "id,name,access_token,category,tasks,picture{url}",
			access_token: userAccessToken,
		};
		try {
			const response = await axios.get<{ data: PageInfo[] }>(url, {
				params,
			});
			return response.data.data;
		} catch (error: any) {
			const fbError = error?.response?.data?.error;
			console.error(
				"[FacebookService] ❌ Error obteniendo páginas:",
				fbError || error.message
			);
			throw new Error(fbError?.message || "Error al obtener páginas");
		}
	}

	async getPagePosts(
		pageAccessToken: string,
		pageId: string,
		limit: number = 10
	): Promise<PagePost[]> {
		const url = this.graphUrl(`/${pageId}/posts`);
		const params = {
			fields: "id,created_time,message,full_picture,permalink_url",
			limit,
			access_token: pageAccessToken,
		};
		try {
			const response = await axios.get<{ data: PagePost[] }>(url, {
				params,
			});
			return response.data.data;
		} catch (error: any) {
			const fbError = error?.response?.data?.error;
			console.error(
				`[FacebookService] ❌ Error obteniendo posts de página ${pageId}:`,
				fbError || error.message
			);
			throw new Error(fbError?.message || "Error al obtener posts");
		}
	}

  async getPageDetails(
    pageAccessToken: string,
    pageId: string
  ): Promise<{ id: string; name: string }> {
		const url = this.graphUrl(`/${pageId}`);
		const params = { fields: "id,name", access_token: pageAccessToken };
		try {
			const response = await axios.get<{ id: string; name: string }>(
				url,
				{ params }
			);
			return response.data;
		} catch (error: any) {
			const fbError = error?.response?.data?.error;
			console.error(
				`[FacebookService] ❌ Error obteniendo detalles de página ${pageId}:`,
				fbError || error.message
			);
			throw new Error(
				fbError?.message || "Error al obtener detalles de página"
			);
    }
  }

  /**
   * Obtiene el conteo de seguidores (followers_count) y el conteo de fans/likes (fan_count)
   * de una página de Facebook. Devuelve ambos valores para que el consumidor
   * decida cuál utilizar.
   */
  async getPageFollowerStats(
    pageAccessToken: string,
    pageId: string
  ): Promise<{ followers_count?: number; fan_count?: number }> {
    const url = this.graphUrl(`/${pageId}`);
    const params = {
      fields: "followers_count,fan_count",
      access_token: pageAccessToken,
    };
    try {
      const response = await axios.get<{ followers_count?: number; fan_count?: number }>(url, { params });
      return {
        followers_count: response.data?.followers_count,
        fan_count: response.data?.fan_count,
      };
    } catch (error: any) {
      const fbError = error?.response?.data?.error;
      console.error(
        `[FacebookService] ❌ Error obteniendo followers de página ${pageId}:`,
        fbError || error.message
      );
      throw new Error(fbError?.message || "Error al obtener followers de la página");
    }
  }

  /**
   * Builds a stable redirect URL to the page profile picture.
   * This does NOT call the Graph API; it only returns the URL that redirects to the current picture.
   * You can use it directly in <img src="..." /> on the frontend.
   */
  getPageProfilePictureRedirectUrl(
    pageId: string,
    opts?: { type?: "small" | "normal" | "large"; width?: number; height?: number }
  ): string {
    const base = `https://graph.facebook.com/${pageId}/picture`;
    const params: Record<string, string | number> = {};
    if (opts?.width && opts?.height) {
      params.width = opts.width;
      params.height = opts.height;
    } else if (opts?.type) {
      params.type = opts.type;
    }
    const query = Object.keys(params)
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(params[k]))}`)
      .join("&");
    return query ? `${base}?${query}` : base;
  }

  async getPostsInsights(
    pageAccessToken: string,
    postIds: string[]
  ): Promise<Map<string, any>> {
		const lifetimeMetrics = ["post_reactions_by_type_total"];
		const dailyMetrics = [
			"post_impressions",
			"post_impressions_unique",
			"post_engaged_users",
			"post_video_views",
		];
		const batchRequests: {
			method: "GET";
			relative_url: string;
			postId: string;
		}[] = [];
		postIds.forEach((postId) => {
			batchRequests.push({
				method: "GET",
				relative_url: `/${postId}/insights?metric=${lifetimeMetrics.join(
					","
				)}&period=lifetime`,
				postId,
			});
			batchRequests.push({
				method: "GET",
				relative_url: `/${postId}/insights?metric=${dailyMetrics.join(
					","
				)}&period=day`,
				postId,
			});
		});
		const url = this.graphUrl("/"); // Batch requests go to root with version
		const params = {
			access_token: pageAccessToken,
			batch: JSON.stringify(
				batchRequests.map((req) => ({
					method: req.method,
					relative_url: req.relative_url,
				}))
			),
		};
		try {
			const response = await axios.post<any[]>(url, null, { params });
			const insightsMap = new Map<string, any>();
			response.data.forEach((result, index) => {
				const { postId } = batchRequests[index];
				if (result && result.code === 200) {
					const body = JSON.parse(result.body);
					if (body.data && body.data.length > 0) {
						if (!insightsMap.has(postId))
							insightsMap.set(postId, {});
						const postInsights = insightsMap.get(postId);
						body.data.forEach((metric: any) => {
							if (metric.values && metric.values.length > 0) {
								postInsights[metric.name] =
									metric.period === "day"
										? metric.values.reduce(
												(sum: number, day: any) =>
													sum + (day.value || 0),
												0
										  )
										: metric.values[0].value;
							}
						});
					}
				} else {
					console.warn(
						`[FacebookService] ⚠️  Sin insights para post ${postId}. Respuesta:`,
						result
					);
				}
			});
			return insightsMap;
		} catch (error: any) {
			const fbError = error?.response?.data?.error;
			console.error(
				"[FacebookService] ❌ Error obteniendo insights:",
				fbError || error.message
			);
			throw new Error(fbError?.message || "Error al obtener insights");
		}
	}

	async createPagePost(
		// Texto/Enlaces
		pageAccessToken: string,
		pageId: string,
		payload: CreatePostPayload
	): Promise<CreatePostResponse> {
		const url = this.graphUrl(`/${pageId}/feed`);
		const params = { ...payload, access_token: pageAccessToken };
		try {
			const response = await axios.post<CreatePostResponse>(url, null, {
				params,
			});
			return response.data;
		} catch (error: any) {
			const fbError = error?.response?.data?.error;
			console.error(
				"[FacebookService] ❌ Error creando post texto/enlace:",
				fbError || error.message
			);
			throw new Error(
				fbError?.message || "Error al crear post de texto/enlace"
			);
		}
	}

	async createPagePhotoPost(
		// Foto Única
		pageAccessToken: string,
		pageId: string,
		payload: CreatePhotoPayload
	): Promise<CreatePhotoResponse> {
		const url = this.graphUrl(`/${pageId}/photos`);
		const params = { ...payload, access_token: pageAccessToken };
		try {
			const response = await axios.post<CreatePhotoResponse>(url, null, {
				params,
			});
			return response.data;
		} catch (error: any) {
			const fbError = error?.response?.data?.error;
			console.error(
				"[FacebookService] ❌ Error creando post foto única:",
				fbError || error.message
			);
			throw new Error(fbError?.message || "Error al crear post de foto");
		}
	}

	async uploadUnpublishedPhoto(
		// Carrusel Paso 1
		pageAccessToken: string,
		pageId: string,
		payload: UnpublishedPhotoPayload
	): Promise<UnpublishedPhotoResponse> {
		const url = this.graphUrl(`/${pageId}/photos`);
		const params = {
			...payload,
			published: false,
			access_token: pageAccessToken,
		};
		try {
			const response = await axios.post<UnpublishedPhotoResponse>(
				url,
				null,
				{ params }
			);
			return response.data;
		} catch (error: any) {
			const fbError = error?.response?.data?.error;
			console.error(
				"[FacebookService] ❌ Error subiendo foto no publicada:",
				fbError || error.message
			);
			throw new Error(
				fbError?.message || "Error al subir foto no publicada"
			);
		}
	}

	async publishCarouselPost(
		// Carrusel Paso 2
		pageAccessToken: string,
		pageId: string,
		payload: CarouselPostPayload
	): Promise<CreatePostResponse> {
		const url = this.graphUrl(`/${pageId}/feed`);
		const params = {
			message: payload.message,
			attached_media: JSON.stringify(payload.attached_media),
			access_token: pageAccessToken,
		};
		try {
			const response = await axios.post<CreatePostResponse>(url, null, {
				params,
			});
			return response.data;
		} catch (error: any) {
			const fbError = error?.response?.data?.error;
			console.error(
				"[FacebookService] ❌ Error creando carrusel:",
				fbError || error.message
			);
			throw new Error(
				fbError?.message || "Error al crear post de carrusel"
			);
		}
	}

	async createPageVideoPost(
		// Video Inmediato
		pageAccessToken: string,
		pageId: string,
		payload: CreateVideoPayload
	): Promise<CreateVideoResponse> {
		const url = this.graphUrl(`/${pageId}/videos`);
		const params = { ...payload, access_token: pageAccessToken };
		try {
			const response = await axios.post<CreateVideoResponse>(url, null, {
				params,
			});
			return { id: response.data.id };
		} catch (error: any) {
			const fbError = error?.response?.data?.error;
			console.error(
				"[FacebookService] ❌ Error creando post de video:",
				fbError || error.message
			);
			throw new Error(fbError?.message || "Error al crear post de video");
		}
	}

  async getScheduledPagePosts(
    pageAccessToken: string,
    pageId: string,
    limit: number = 25
  ): Promise<ScheduledPagePost[]> {
    const url = this.graphUrl(`/${pageId}/scheduled_posts`); // <-- El endpoint clave
    const params = {
      // Campos ampliados para traer previews de fotos y videos (cuando estén disponibles)
      fields:
        [
          "id",
          "scheduled_publish_time",
          "message",
          "full_picture",
          "attachments{media,type,url,subattachments}",
          "status_type",
          "is_published",
          "created_time",
          // "permalink_url" suele no existir hasta que se publica, pero lo solicitamos por si acaso
          "permalink_url",
        ].join(","),
      limit,
      access_token: pageAccessToken,
    };

    try {
      const response = await axios.get<{ data: ScheduledPagePost[] }>(url, {
        params,
      });
      return response.data.data;
    } catch (error: any) {
      const fbError = error?.response?.data?.error;
      console.error(
        `[FacebookService] ❌ Error obteniendo posts programados de ${pageId}:`,
        fbError || error.message
      );

      // Si la API de FB devuelve un error específico (ej. permisos), lo lanzamos
      if (fbError) {
         // Un error común es de permisos si falta 'pages_read_engagement'
         if (fbError.code === 10 || fbError.code === 200) { 
           console.error("[FacebookService] ⚠️  Error de permisos. Asegúrese de tener 'pages_read_engagement'.");
         }
        throw new Error(fbError.message);
      }
      
      throw new Error("Error al obtener posts programados");
    }
  }

  async getPageInsights(
    pageAccessToken: string,
    pageId: string,
    metrics: string[],
    opts?: {
      period?: 'day' | 'week' | 'days_28' | 'month' | 'lifetime' | 'total_over_range';
      since?: string; // ISO or Unix timestamp accepted by Graph API
      until?: string; // ISO or Unix timestamp accepted by Graph API
      date_preset?:
        | 'today'
        | 'yesterday'
        | 'this_month'
        | 'last_month'
        | 'this_quarter'
        | 'maximum'
        | 'data_maximum'
        | 'last_3d'
        | 'last_7d'
        | 'last_14d'
        | 'last_28d'
        | 'last_30d'
        | 'last_90d'
        | 'last_week_mon_sun'
        | 'last_week_sun_sat'
        | 'last_quarter'
        | 'last_year'
        | 'this_week_mon_today'
        | 'this_week_sun_today'
        | 'this_year';
    }
  ): Promise<Record<string, { total?: number; values?: Array<{ end_time?: string; value?: number }> }>> {
    const url = this.graphUrl(`/${pageId}/insights`);
    const params: Record<string, any> = {
      metric: metrics.join(','),
      access_token: pageAccessToken,
    };
    if (opts?.period) params.period = opts.period;
    if (opts?.date_preset && !opts.since && !opts.until) params.date_preset = opts.date_preset;
    if (opts?.since) params.since = opts.since;
    if (opts?.until) params.until = opts.until;
    try {
      const response = await axios.get<{ data: Array<{ name: string; period: string; values: Array<{ end_time?: string; value?: number }> }> }>(url, { params });
      const result: Record<string, { total?: number; values?: Array<{ end_time?: string; value?: number }> }> = {};
      for (const item of response.data.data || []) {
        const values = item.values || [];
        const total = values.reduce((sum, v) => sum + (typeof v.value === 'number' ? v.value : 0), 0);
        result[item.name] = { total, values };
      }
      return result;
    } catch (error: any) {
      const fbError = error?.response?.data?.error;
			console.error('eerorrrr: ', error.response.data)
      if (fbError) {
        const err = new Error(fbError?.message || 'Facebook Page Insights API error');
        (err as any).meta = {
          type: fbError?.type,
          code: fbError?.code,
          error_subcode: fbError?.error_subcode,
          error_user_title: fbError?.error_user_title,
          error_user_msg: fbError?.error_user_msg,
          fbtrace_id: fbError?.fbtrace_id,
        };
        throw err;
      }
      throw error;
    }
  }

	/**
   * Obtiene las cuentas publicitarias (Ad Accounts) asociadas a un Token de Usuario.
   * REQUIERE el permiso 'ads_management' o 'ads_read'.
   * @param userAccessToken Un Token de Acceso de USUARIO (no de página).
   * @returns Una lista de cuentas publicitarias.
   */
  async getAdAccounts(userAccessToken: string): Promise<AdAccountInfo[]> {
    const url = this.graphUrl("/me/adaccounts");
    const params = {
      fields: "id,name,account_id,business{id,name}", // Campos útiles
      limit: 250, // Traer un límite alto
      access_token: userAccessToken,
    };
    try {
      const response = await axios.get<{ data: AdAccountInfo[] }>(url, {
        params,
      });
      return response.data.data;
    } catch (error: any) {
      const fbError = error?.response?.data?.error;
      console.error(
        "[FacebookService] ❌ Error obteniendo Ad Accounts:",
        fbError || error.message
      );
      // Lanza el error original para que el controlador lo atrape
      throw error; 
    }
  }

}

export const facebookService = new FacebookService();
