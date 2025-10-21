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

export class InstagramService {
	private readonly apiBase = "https://graph.facebook.com";
	private readonly apiVersion = process.env.FACEBOOK_API_VERSION || "v24.0";

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
		console.log(
			`[InstagramService] 📊 Obteniendo insights para ${mediaIds.length} publicaciones de Instagram...`
		);

		// Las métricas que ya pedíamos (engagement y reach están aquí)
		const metrics = 'total_interactions,views,reach,saved';
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

			console.log(
				`[InstagramService] ✅ Insights obtenidos para ${insightsMap.size} de ${mediaIds.length} publicaciones.`
			);
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
}

const instagramService = new InstagramService();
export default instagramService;
export { instagramService };
