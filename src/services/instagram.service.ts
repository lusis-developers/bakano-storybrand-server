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
}

const instagramService = new InstagramService();
export default instagramService;
export { instagramService };
