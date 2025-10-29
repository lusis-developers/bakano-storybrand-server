import models from "../models";
import CustomError from "../errors/customError.error";
import { HttpStatusCode } from "axios";
import { cloudinaryService } from "./cloudinary.service";
import {
	facebookService,
	CreatePhotoPayload,
	CarouselPostPayload,
	CreatePostResponse,
	CreatePhotoResponse,
} from "./facebook.service";

interface PostPayloadData {
	message?: string;
	published?: boolean;
	scheduled_publish_time?: number | string;
}

interface PublishResult {
	type: "photo" | "carousel";
	data: CreatePhotoResponse | CreatePostResponse;
}

export interface CreateVideoPayload {
	file_url: string;
	description?: string;
	title?: string;
	published?: boolean;
	scheduled_publish_time?: number | string;
}
export interface CreateVideoResponse {
	id: string;
}
interface VideoPayloadData {
	message?: string;
	description?: string;
	title?: string;
	published?: boolean;
	scheduled_publish_time?: number | string;
}
interface PublishVideoResult {
	type: "video";
	data: { video_id: string; post_id?: string };
}

export class FacebookPostService {
	async publishPhotoPost(
		businessId: string,
		payloadData: PostPayloadData,
		files: Express.Multer.File[]
	): Promise<PublishResult> {
		const integration = await models.integration
			.findOne({
				business: businessId,
				type: "facebook",
				isConnected: true,
			})
			.select("+config.accessToken");

		if (
			!integration ||
			!integration.config.accessToken ||
			!integration.metadata?.pageId
		) {
			throw new CustomError(
				"Active Facebook integration not found or is incomplete",
				HttpStatusCode.NotFound
			);
		}
		const pageAccessToken = integration.config.accessToken;
		const pageId = integration.metadata.pageId;
		const uploadPromises = files.map((file) =>
			cloudinaryService.uploadImage(file.buffer)
		);
		const cloudinaryResults = await Promise.all(uploadPromises);
		const { message, published, scheduled_publish_time } = payloadData;
		if (cloudinaryResults.length === 1) {
			const payload: CreatePhotoPayload = {
				url: cloudinaryResults[0].secure_url,
				message,
				published,
				scheduled_publish_time,
			};
			const result = await facebookService.createPagePhotoPost(
				pageAccessToken,
				pageId,
				payload
			);
			return { type: "photo", data: result };
		} else {
			const fbUploadPromises = cloudinaryResults.map((upload) =>
				facebookService.uploadUnpublishedPhoto(
					pageAccessToken,
					pageId,
					{ url: upload.secure_url }
				)
			);
			const fbUploadResults = await Promise.all(fbUploadPromises);
			const attachedMedia = fbUploadResults.map((result) => ({
				media_fbid: result.id,
			}));
			const payload: CarouselPostPayload = {
				message,
				attached_media: attachedMedia,
			};

			const result = await facebookService.publishCarouselPost(
				pageAccessToken,
				pageId,
				payload
			);
			return { type: "carousel", data: result };
		}
	}
	async publishVideoPost(
		businessId: string,
		payloadData: VideoPayloadData,
		file: Express.Multer.File
	): Promise<PublishVideoResult> {
		const integration = await models.integration
			.findOne({
				business: businessId,
				type: "facebook",
				isConnected: true,
			})
			.select("+config.accessToken");

		if (
			!integration ||
			!integration.config.accessToken ||
			!integration.metadata?.pageId
		) {
			throw new CustomError(
				"Active Facebook integration not found or is incomplete",
				HttpStatusCode.NotFound
			);
		}
		const pageAccessToken = integration.config.accessToken;
		const pageId = integration.metadata.pageId;
		const cloudinaryResult = await cloudinaryService.uploadVideo(
			file.buffer,
			"facebook-videos"
		);
		const {
			message,
			description,
			title,
			published,
			scheduled_publish_time,
		} = payloadData;
		const videoPayload: CreateVideoPayload = {
			file_url: cloudinaryResult.secure_url,
			description: description || message || "",
			title: title,
			published: published,
			scheduled_publish_time: scheduled_publish_time,
		};
		const result = await facebookService.createPageVideoPost(
			pageAccessToken,
			pageId,
			videoPayload
		);

		return { type: "video", data: { video_id: result.id } };
	}
}

export const facebookPostService = new FacebookPostService();
