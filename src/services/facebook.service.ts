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
	// Aquí se podrían añadir más campos como 'targeting' si fuera necesario
}

export interface CreatePostResponse {
	id: string; // El ID de la nueva publicación (page_post_id)
}

export interface CreatePhotoPayload {
  url: string;      // URL pública de la imagen
  message?: string; // El texto que acompaña a la foto (el 'caption')
  published?: boolean;
  scheduled_publish_time?: number | string;
}

export interface CreatePhotoResponse {
  id: string;       // El ID del objeto 'photo'
  post_id: string;  // El ID de la publicación ('page_post_id')
}

export class FacebookService {
	private readonly config: FacebookServiceConfig;

	constructor(config?: Partial<FacebookServiceConfig>) {
		const defaults: FacebookServiceConfig = {
			apiVersion: process.env.FACEBOOK_API_VERSION || "v23.0",
			appId: process.env.FACEBOOK_APP_ID || "0",
			appSecret: process.env.FACEBOOK_APP_SECRET || "0",
		};

		this.config = {
			...defaults,
			...(config || {}),
		} as FacebookServiceConfig;
		console.log("[FacebookService] Inicializado con configuración:", {
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
	async exchangeLongLivedUserAccessToken(
		shortLivedAccessToken: string
	): Promise<ExchangeTokenResponse> {
		console.log(
			"[FacebookService] Iniciando intercambio de token corto por largo..."
		);
		const url = this.graphUrl("/oauth/access_token");
		const params = {
			grant_type: "fb_exchange_token",
			client_id: this.config.appId,
			client_secret: this.config.appSecret,
			fb_exchange_token: shortLivedAccessToken,
		};

		console.log("[FacebookService] URL de intercambio:", url);
		console.log("[FacebookService] Parámetros:", {
			grant_type: params.grant_type,
			client_id: params.client_id,
			client_secret: `${params.client_secret.slice(0, 6)}...`,
			fb_exchange_token: `${shortLivedAccessToken.slice(0, 8)}...`,
		});

		try {
			const response = await axios.get<ExchangeTokenResponse>(url, {
				params,
			});
			console.log("[FacebookService] Respuesta del intercambio:", {
				access_token: `${response.data.access_token.slice(0, 12)}...`,
				expires_in: response.data.expires_in,
				token_type: response.data.token_type,
			});
			return response.data;
		} catch (error: any) {
			const fbError = error?.response?.data || error?.message;
			console.error(
				"[FacebookService] Error en el intercambio de token:",
				fbError
			);
			throw new Error(
				error?.response?.data?.error?.message ||
					"Error al intercambiar token en Facebook"
			);
		}
	}

	async getUserPages(userAccessToken: string): Promise<PageInfo[]> {
		console.log("[FacebookService] obteniendo pagina del usuario...");
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
			const fbError = error?.response?.data || error?.message;
			console.error(
				"[FacebookService] Error en el intercambio de token:",
				fbError
			);
			throw new Error(
				error?.response?.data?.error?.message ||
					"Error al obtener paginas en Facebook"
			);
		}
	}

	async getPagePosts(
		pageAccessToken: string,
		pageId: string,
		limit: number = 10
	): Promise<PagePost[]> {
		console.log(
			`[FacebookService] Obteniendo las últimas ${limit} publicaciones de la página ${pageId}...`
		);
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
			console.log(
				`[FacebookService] ✅ Se obtuvieron ${response.data.data.length} publicaciones.`
			);
			return response.data.data;
		} catch (error: any) {
			const fbError = error?.response?.data || error?.message;
			console.error(
				`[FacebookService] Error al obtener las publicaciones de la página ${pageId}:`,
				fbError
			);
			throw new Error(
				error?.response?.data?.error?.message ||
					"Error al obtener las publicaciones de Facebook"
			);
		}
	}

	async getPageDetails(
		pageAccessToken: string,
		pageId: string
	): Promise<{ id: string; name: string }> {
		console.log(
			`[FacebookService] Obteniendo detalles de la página ${pageId}...`
		);
		const url = this.graphUrl(`/${pageId}`);
		const params = {
			fields: "id,name",
			access_token: pageAccessToken,
		};

		try {
			const response = await axios.get<{ id: string; name: string }>(
				url,
				{ params }
			);
			return response.data;
		} catch (error: any) {
			const fbError = error?.response?.data || error?.message;
			console.error(
				`[FacebookService] Error al obtener detalles de la página ${pageId}:`,
				fbError
			);
			throw new Error(
				error?.response?.data?.error?.message ||
					"Error al obtener detalles de la página en Facebook"
			);
		}
	}

	/**
	 * Obtiene las estadísticas (insights) para una lista de publicaciones usando una petición por lotes (batch request).
	 * Maneja métricas válidas en posts y añade period para métricas con restricciones.
	 * @param pageAccessToken Token de acceso de la Página (con permisos read_insights y pages_read_engagement, y tarea ANALYZE).
	 * @param postIds IDs de las publicaciones (formato {pageId}_{postId}).
	 * @param options Opcional: period, since, until.
	 * @returns Un Map donde la clave es el ID de la publicación y el valor es un objeto con sus estadísticas.
	 */
	async getPostsInsights(
		pageAccessToken: string,
		postIds: string[]
	): Promise<Map<string, any>> {
		console.log(
			`[FacebookService] 📊 Obteniendo insights para ${postIds.length} publicaciones...`
		);

		// --- LISTA DE MÉTRICAS REFINADA Y DIVIDIDA POR 'PERIOD' ---
		const lifetimeMetrics = ["post_reactions_by_type_total"];
		const dailyMetrics = [
			"post_impressions",
			"post_impressions_unique",
			"post_engaged_users",
			"post_video_views",
		];

		// Construimos la petición por lotes. Cada post tendrá dos sub-peticiones: una para métricas 'lifetime' y otra para 'daily'.
		const batchRequests: {
			method: "GET";
			relative_url: string;
			postId: string;
		}[] = [];
		postIds.forEach((postId) => {
			// Sub-petición para métricas de por vida
			batchRequests.push({
				method: "GET",
				relative_url: `${
					this.config.apiVersion
				}/${postId}/insights?metric=${lifetimeMetrics.join(
					","
				)}&period=lifetime`,
				postId: postId,
			});
			// Sub-petición para métricas diarias (la API las suma si no se especifica 'since'/'until')
			batchRequests.push({
				method: "GET",
				relative_url: `${
					this.config.apiVersion
				}/${postId}/insights?metric=${dailyMetrics.join(
					","
				)}&period=day`,
				postId: postId,
			});
		});

		const url = `https://graph.facebook.com/${this.config.apiVersion}`;
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

			// Procesamos y fusionamos los resultados de las sub-peticiones
			response.data.forEach((result, index) => {
				const { postId } = batchRequests[index];

				if (result && result.code === 200) {
					const body = JSON.parse(result.body);
					if (body.data && body.data.length > 0) {
						// Inicializamos el objeto de insights para este post si no existe
						if (!insightsMap.has(postId)) {
							insightsMap.set(postId, {});
						}
						const postInsights = insightsMap.get(postId);

						// Fusionamos los resultados en el objeto
						body.data.forEach((metric: any) => {
							if (metric.values && metric.values.length > 0) {
								// Para métricas diarias, sumamos los valores si hay varios días
								if (metric.period === "day") {
									postInsights[metric.name] =
										metric.values.reduce(
											(sum: number, day: any) =>
												sum + (day.value || 0),
											0
										);
								} else {
									// Para lifetime, tomamos el primer valor
									postInsights[metric.name] =
										metric.values[0].value;
								}
							}
						});
					}
				} else {
					const errorBody = result
						? JSON.parse(result.body)
						: { error: { message: "Respuesta desconocida" } };
					console.warn(
						`[FacebookService] ⚠️ Falló sub-petición para post ${postId}:`,
						errorBody.error.message
					);
				}
			});

			console.log(
				`[FacebookService] ✅ Insights obtenidos para ${insightsMap.size} de ${postIds.length} publicaciones.`
			);
			return insightsMap;
		} catch (error: any) {
			const fbError = error?.response?.data || error?.message;
			console.error(
				`[FacebookService] Error al obtener insights por lotes:`,
				fbError
			);
			// Importante: no retornes el mensaje crudo; normaliza
			throw new Error(
				error?.response?.data?.error?.message ||
					"Error al obtener insights de Facebook"
			);
		}
	}

  async createPagePost(
    pageAccessToken: string,
    pageId: string,
    payload: CreatePostPayload
  ): Promise<CreatePostResponse> {
    console.log('[FacebookService] 📝 Creando publicación en la página: ', pageId);

    const url = this.graphUrl(`/ ${pageId}/feed`);

    const params = {
      ...payload,
      access_token: pageAccessToken
    }

    console.log('[FacebookService] 📝 Parámetros de la solicitud: ', params)
    
    try {

      const response = await axios.post<CreatePostResponse>(url, null, { params });
      
      console.log(`[FacebookService] ✅ Publicación creada con ID: ${response.data.id}`);
      return response.data;

    } catch (error: any) {
      const fbError = error?.response?.data || error?.message;
      console.error(`[FacebookService] ❌ Error al crear la publicación en la página ${pageId}:`, fbError);
      // Normalizamos el error para que el controlador lo capture
      throw new Error(error?.response?.data?.error?.message || 'Error al crear la publicación en Facebook');
    }
    
    

  }

  /**
   * =================================================================
   * NUEVO MÉTODO (PARA FOTOS)
   * =================================================================
   * Publica una FOTO en una Página de Facebook.
   * Corresponde a: POST /{page_id}/photos
   *
   * @param pageAccessToken Token de acceso de la Página.
   * @param pageId El ID de la Página donde se publicará.
   * @param payload Objeto con los datos del post (url de la foto, message)
   * @returns Los IDs de la foto y de la publicación.
   */
  async createPagePhotoPost(
    pageAccessToken: string,
    pageId: string,
    payload: CreatePhotoPayload
  ): Promise<CreatePhotoResponse> {
    
    console.log(`[FacebookService] 🖼️ Creando publicación de FOTO en la página ${pageId}...`);
    
    // Apuntamos al endpoint /photos
    const url = this.graphUrl(`/${pageId}/photos`);

    // El payload (que contiene 'url' y 'message') se pasa como 'params'
    const params = {
      ...payload,
      access_token: pageAccessToken,
    };

    // Logueamos los parámetros sin el token por seguridad
    console.log('[FacebookService] Publicando FOTO con payload:', payload);

    try {
      const response = await axios.post<CreatePhotoResponse>(url, null, { params });
      
      console.log(`[FacebookService] ✅ Publicación de FOTO creada con post_id: ${response.data.post_id}`);
      return response.data;

    } catch (error: any) {
      const fbError = error?.response?.data || error?.message;
      console.error(`[FacebookService] ❌ Error al crear la publicación de FOTO en la página ${pageId}:`, fbError);
      throw new Error(error?.response?.data?.error?.message || 'Error al crear la publicación de foto en Facebook');
    }
  }
}

export const facebookService = new FacebookService();
