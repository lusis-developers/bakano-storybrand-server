import axios, { HttpStatusCode } from "axios";
import CustomError from "../errors/customError.error";

export interface InstagramMediaItem {
	id: string;
	caption?: string;
	media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
	media_url?: string;
	permalink: string;
	thumbnail_url?: string;
	timestamp: string;
	children?: {
		data: Array<{
			id: string;
			media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
			media_url?: string;
			thumbnail_url?: string;
		}>;
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

export interface InstagramPostInsight {
	engagement: number;
	impressions: number;
	reach: number;
	saved: number;
	// Nota: video_views se puede añadir si se filtra por media_type === 'VIDEO'
}

export interface CreateMediaContainerPayload {
	media_type?: "IMAGE" | "REELS" | "CAROUSEL";
	image_url?: string;
	video_url?: string;
	caption?: string;
	is_carousel_item?: boolean;
	children?: string[];
	share_to_feed?: boolean;
	thumb_offset?: number;
	published?: boolean;
	scheduled_publish_time?: string | number
}

export interface MediaContainerResponse {
	id: string;
}

export interface PublishMediaResponse {
	id: string;
}

export interface MediaContainerStatusResponse {
	status_code: "EXPIRED" | "ERROR" | "FINISHED" | "IN_PROGRESS" | "PUBLISHED";
	status: string;
	id: string;
}

export class InstagramService {
  private readonly apiBase = "https://graph.facebook.com";
  private readonly apiVersion = process.env.FACEBOOK_API_VERSION || "v24.0";

  /**
   * Obtiene información básica del perfil de un usuario de Instagram Business/Creator.
   * Devuelve id, username, profile_picture_url y followers_count.
   */
  async getUserProfile(
    igUserId: string,
    accessToken: string
  ): Promise<{ id: string; username?: string; profile_picture_url?: string; followers_count?: number }> {
    const url = `${this.apiBase}/${this.apiVersion}/${igUserId}`;
    const params = {
      fields: "id,username,profile_picture_url,followers_count",
      access_token: accessToken,
    };

    try {
      const { data } = await axios.get(url, { params });
      return {
        id: data?.id,
        username: data?.username,
        profile_picture_url: data?.profile_picture_url,
        followers_count: data?.followers_count,
      };
    } catch (error: any) {
      const fbError = error?.response?.data?.error;
      console.error(
        `[InstagramService] Error en getUserProfile (IG User ${igUserId}):`,
        fbError || error.message
      );
      throw new CustomError(
        fbError?.message || "Error al obtener el perfil de Instagram",
        error?.response?.status || HttpStatusCode.InternalServerError
      );
    }
  }

  /**
   * Fetch latest media for an Instagram Business account (igUserId)
   */
  async getUserMedia(
    igUserId: string,
		accessToken: string,
		limit: number = 10
	): Promise<InstagramMediaItem[]> {
		try {
			const fields = [
				"id",
				"caption",
				"media_type",
				"media_url",
				"permalink",
				"thumbnail_url",
				"timestamp",
				"children.limit(10){id,media_type,media_url,thumbnail_url}",
				"like_count",
				"comments_count",
			].join(",");

			const url = `${this.apiBase}/${this.apiVersion}/${igUserId}/media`;

			const { data } = await axios.get(url, {
				params: {
					fields,
					access_token: accessToken,
					limit,
				},
			});

			return data?.data || [];
		} catch (error: any) {
			const fbError = error?.response?.data?.error;
			console.error(
				`[InstagramService] Error en getUserMedia (IG User ${igUserId}):`,
				fbError || error.message
			);
			// Lanzamos un CustomError para que el controlador lo maneje
			throw new CustomError(
				fbError?.message ||
					"Error al obtener las publicaciones de Instagram",
				error?.response?.status || HttpStatusCode.InternalServerError
			);
		}
	}

	async getMultipleMediaInsights(
		mediaIds: string[],
		accessToken: string
	): Promise<Map<string, InstagramPostInsight>> {
		// Las métricas que ya pedíamos (engagement y reach están aquí)
		const metrics = "total_interactions,views,reach,saved";
		const period = "lifetime";

		// 1. Construir las peticiones por lotes
		const batchRequests = mediaIds.map((mediaId) => ({
			method: "GET",
			relative_url: `${this.apiVersion}/${mediaId}/insights?metric=${metrics}&period=${period}`,
		}));

		// 2. Preparar la llamada a la API
		const url = `${this.apiBase}/`;
		const params = {
			access_token: accessToken,
			batch: JSON.stringify(batchRequests),
		};

		try {
			// 3. Ejecutar la única llamada por lotes
			const response = await axios.post<any[]>(url, null, { params });

			// 4. Procesar la respuesta
			const insightsMap = new Map<string, InstagramPostInsight>();

			response.data.forEach((result, index) => {
				const mediaId = mediaIds[index];

				if (result && result.code === 200) {
					const body = JSON.parse(result.body);
					const insightData = body.data;

					const getValue = (name: string): number => {
						const metric = insightData.find(
							(m: any) => m.name === name
						);
						return metric?.values[0]?.value || 0;
					};

					insightsMap.set(mediaId, {
						engagement: getValue("total_interactions"),
						impressions: getValue("impressions"),
						reach: getValue("reach"),
						saved: getValue("saved"),
					});
				} else {
					const errorBody = result
						? JSON.parse(result.body)
						: { error: { message: "Respuesta desconocida" } };
					console.warn(
						`[InstagramService] ⚠️ Falló sub-petición de insights para media ${mediaId}:`,
						errorBody.error.message
					);
				}
			});

			return insightsMap;
		} catch (error: any) {
			const fbError = error?.response?.data?.error;
			console.error(
				`[InstagramService] Error en getMultipleMediaInsights:`,
				fbError || error.message
			);
			throw new CustomError(
				fbError?.message ||
					"Error al obtener insights de las publicaciones de Instagram",
				error?.response?.status || HttpStatusCode.InternalServerError
			);
		}
	}

	async createMediaContainer(
		igUserId: string,
		accessToken: string,
		payload: CreateMediaContainerPayload
	): Promise<MediaContainerResponse> {
		const mediaType =
			payload.media_type || (payload.image_url ? "IMAGE" : "VIDEO");

		const url = `${this.apiBase}/${this.apiVersion}/${igUserId}/media`;

		const params = {
			...payload,
			access_token: accessToken,
		};

		try {
			const response = await axios.post<MediaContainerResponse>(
				url,
				params
			);
			return response.data;
		} catch (error: any) {
			const fbError = error?.response?.data?.error;

			console.error("errorrrr: ", error.response.data);

			throw new CustomError(
				fbError?.nessage ||
					"Error al crear el contenedor de media en Instagram",
				error?.response?.status || HttpStatusCode.InternalServerError
			);
		}
	}

	async publishMediaContainer(
		igUserId: string,
		accessToken: string,
		containerId: string
	): Promise<PublishMediaResponse> {
		const url = `${this.apiBase}/${this.apiVersion}/${igUserId}/media_publish`;

		const params = {
			creation_id: containerId,
			access_token: accessToken,
		};

		try {
			const response = await axios.post<PublishMediaResponse>(
				url,
				params
			);
			return response.data;
		} catch (error: any) {
			const fbError = error?.response?.data?.error;
			console.error(
				`[InstagramService] ❌ Error al publicar contenedor ${containerId}:`,
				fbError || error.message
			);
			throw new CustomError(
				fbError?.message ||
					`Error al publicar el contenedor ${containerId} en Instagram`,
				error?.response?.status || HttpStatusCode.InternalServerError
			);
		}
	}

	async checkContainerStatus(
		containerId: string,
		accessToken: string
	): Promise<MediaContainerStatusResponse> {
		const url = `${this.apiBase}/${this.apiVersion}/${containerId}`;
		const params = {
			fields: "status_code,status", // Pedimos el código y el mensaje
			access_token: accessToken,
		};

		try {
			const response = await axios.get<MediaContainerStatusResponse>(
				url,
				{ params }
			);
			return response.data;
		} catch (error: any) {
			const fbError = error?.response?.data?.error;
			console.error(
				`[InstagramService] ❌ Error al verificar estado del contenedor ${containerId}:`,
				fbError || error.message
			);
			throw new CustomError(
				fbError?.message ||
					`Error al verificar estado del contenedor ${containerId}`,
				error?.response?.status || HttpStatusCode.InternalServerError
			);
		}
	}

	async getUserInsights(
		igUserId: string,
		accessToken: string,
		metrics: string[],
		opts?: { period?: string; since?: string; until?: string; date_preset?: string; metric_type?: 'time_series' | 'total_value'; breakdown?: string }
	): Promise<Record<string, { total?: number; values?: Array<{ end_time?: string; value?: number }>; breakdown?: Array<{ label: string; value: number }> }>> {
		const url = `${this.apiBase}/${this.apiVersion}/${igUserId}/insights`;
		const params: Record<string, any> = {
			metric: metrics.join(','),
			period: opts?.period ? opts.period : 'day',
			access_token: accessToken,
		};
		if (opts?.metric_type) params.metric_type = opts.metric_type;
		if (opts?.breakdown) params.breakdown = opts.breakdown;
		if (opts?.since) params.since = opts.since;
		if (opts?.until) params.until = opts.until;
		if (opts?.date_preset && !opts.since && !opts.until) params.date_preset = opts.date_preset;
		try {
			const response = await axios.get<{ data: Array<any> }>(url, { params });
			const result: Record<string, { total?: number; values?: Array<{ end_time?: string; value?: number }>; breakdown?: Array<{ label: string; value: number }> }> = {};
			for (const item of response.data.data || []) {
				if (item.total_value) {
					const tv = item.total_value;
					const total = typeof tv.value === 'number' ? tv.value : 0;
					const breakdownValues: Array<{ end_time?: string; value?: number }> = [];
					const breakdownPairs: Array<{ label: string; value: number }> = [];
					if (Array.isArray(tv.breakdowns)) {
						for (const b of tv.breakdowns) {
							for (const r of b.results || []) {
								breakdownValues.push({ end_time: r.end_time, value: r.value });
								const label = Array.isArray(r.dimension_values) ? r.dimension_values.join('|') : '';
								breakdownPairs.push({ label, value: typeof r.value === 'number' ? r.value : 0 });
							}
						}
					}
					result[item.name] = { total, values: breakdownValues, breakdown: breakdownPairs };
				} else {
					const values = item.values || [];
					const total = values.reduce((sum: number, v: any) => sum + (typeof v.value === 'number' ? v.value : 0), 0);
					result[item.name] = { total, values };
				}
			}
			return result;
		} catch (error: any) {
			const fbError = error?.response?.data?.error;
			console.error(`[InstagramService] ❌ Error getting user insights for ${igUserId}:`, fbError || error.message);
			throw new CustomError(
				fbError?.message || 'Error getting Instagram user insights',
				error?.response?.status || HttpStatusCode.InternalServerError
			);
		}
	}
}

const instagramService = new InstagramService();
export default instagramService;
export { instagramService };
