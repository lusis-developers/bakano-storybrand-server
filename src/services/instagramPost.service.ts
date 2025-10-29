import { Types } from "mongoose";
import models from "../models";
import CustomError from "../errors/customError.error";
import { HttpStatusCode } from "axios";
import { cloudinaryService } from "./cloudinary.service";

import { ScheduleReelResponse } from "./facebook.service";

import {
	instagramService,
	CreateMediaContainerPayload,
	PublishMediaResponse,
	MediaContainerStatusResponse,
} from "./instagram.service";

interface InstagramPostPayloadData {
	caption?: string;
	share_to_feed?: boolean;
	published?: boolean | string;
	scheduled_publish_time?: number | string;
}

interface InstagramPublishResult {
	type: "photo" | "carousel" | "reel";
	data: PublishMediaResponse | ScheduleReelResponse;
	container_id?: string;
	is_scheduled?: boolean;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class InstagramPostService {
	async publishPhotoOrCarouselPost(
		businessId: string,
		payloadData: InstagramPostPayloadData,
		files: Express.Multer.File[]
	): Promise<InstagramPublishResult> {
		if (!files || files.length === 0) {
			throw new CustomError(
				"No image files provided for Instagram post",
				HttpStatusCode.BadRequest
			);
		}

		const { igUserId, accessToken } = await this.getInstagramCredentials(
			businessId
		);

		const uploadPromises = files.map((file) =>
			cloudinaryService.uploadImage(file.buffer, "instagram-posts")
		);
		const cloudinaryResults = await Promise.all(uploadPromises);

		const { caption } = payloadData;

		if (cloudinaryResults.length === 1) {
			const payload: CreateMediaContainerPayload = {
				image_url: cloudinaryResults[0].secure_url,
				caption: caption,
			};
			const container = await instagramService.createMediaContainer(
				igUserId,
				accessToken,
				payload
			);
			const result = await instagramService.publishMediaContainer(
				igUserId,
				accessToken,
				container.id
			);
			return {
				type: "photo",
				data: result,
				container_id: container.id,
				is_scheduled: false,
			};
		} else {
			const childContainerPromises = cloudinaryResults.map((upload) => {
				const childPayload: CreateMediaContainerPayload = {
					image_url: upload.secure_url,
					is_carousel_item: true,
				};
				return instagramService.createMediaContainer(
					igUserId,
					accessToken,
					childPayload
				);
			});
			const childContainers = await Promise.all(childContainerPromises);
			const childContainerIds = childContainers.map((c) => c.id);

			const parentPayload: CreateMediaContainerPayload = {
				media_type: "CAROUSEL",
				children: childContainerIds,
				caption: caption,
			};
			const parentContainer = await instagramService.createMediaContainer(
				igUserId,
				accessToken,
				parentPayload
			);

			const result = await instagramService.publishMediaContainer(
				igUserId,
				accessToken,
				parentContainer.id
			);
			return {
				type: "carousel",
				data: result,
				container_id: parentContainer.id,
				is_scheduled: false,
			};
		}
	}

	async publishReelPost(
		businessId: string,
		payloadData: InstagramPostPayloadData,
		file: Express.Multer.File
	): Promise<InstagramPublishResult> {
		if (!file) {
			throw new CustomError(
				"No video file provided for Instagram Reel",
				HttpStatusCode.BadRequest
			);
		}

		const { igUserId, accessToken } = await this.getInstagramCredentials(
			businessId
		);

		const cloudinaryResult = await cloudinaryService.uploadVideo(
			file.buffer,
			"instagram-reels"
		);

		const { caption, share_to_feed, published, scheduled_publish_time } =
			payloadData;

		const scheduleTimestamp = scheduled_publish_time
			? typeof scheduled_publish_time === "string"
				? parseInt(scheduled_publish_time, 10)
				: scheduled_publish_time
			: undefined;
		const isValidTimestamp =
			scheduleTimestamp &&
			!isNaN(scheduleTimestamp) &&
			scheduleTimestamp > 0;
		const wantsToSchedule =
			(published === false || published === "false") && isValidTimestamp;

		if (wantsToSchedule) {
			const schedulePayload: CreateMediaContainerPayload = {
				media_type: "REELS",
				video_url: cloudinaryResult.secure_url,
				caption: caption,
				share_to_feed: share_to_feed ?? true,
				published: false,
				scheduled_publish_time: scheduleTimestamp!,
			};

			const result = await instagramService.createMediaContainer(
				igUserId,
				accessToken,
				schedulePayload
			);

			return {
				type: "reel",
				data: result,
				container_id: result.id,
				is_scheduled: true,
			};
		} else {
			const payload: CreateMediaContainerPayload = {
				media_type: "REELS",
				video_url: cloudinaryResult.secure_url,
				caption: caption,
				share_to_feed: share_to_feed ?? true,
			};

			const container = await instagramService.createMediaContainer(
				igUserId,
				accessToken,
				payload
			);

			let statusResult: MediaContainerStatusResponse | null = null;
			const maxRetries = 20;
			const delayBetweenChecks = 6000;

			for (let attempt = 1; attempt <= maxRetries; attempt++) {
				statusResult = await instagramService.checkContainerStatus(
					container.id,
					accessToken
				);
				if (statusResult.status_code === "FINISHED") {
					break;
				}
				if (
					statusResult.status_code === "ERROR" ||
					statusResult.status_code === "EXPIRED"
				) {
					throw new CustomError(
						`IG container failed: ${statusResult.status}`,
						HttpStatusCode.InternalServerError
					);
				}
				if (attempt === maxRetries) {
					throw new CustomError(
						`Instagram media container ${container.id} did not finish processing in time. Last status: ${statusResult?.status_code}`,
						HttpStatusCode.GatewayTimeout
					);
				}
				await sleep(delayBetweenChecks);
			}

			const result = await instagramService.publishMediaContainer(
				igUserId,
				accessToken,
				container.id
			);
			return {
				type: "reel",
				data: result,
				container_id: container.id,
				is_scheduled: false,
			};
		}
	}

	private async getInstagramCredentials(
		businessId: string
	): Promise<{
		igUserId: string;
		accessToken: string;
		pageId: string | null;
	}> {
		if (!businessId || !Types.ObjectId.isValid(businessId)) {
			throw new CustomError(
				"Invalid or missing businessId",
				HttpStatusCode.BadRequest
			);
		}

        const integration = await models.integration
            .findOne({
                business: businessId,
                type: "instagram",
                isConnected: true,
            })
            .select(
                "+config.accessToken metadata.pageId metadata.instagramAccountId"
            );

		if (!integration) {
			throw new CustomError(
				`Active Instagram integration not found for business ${businessId}`,
				HttpStatusCode.NotFound
			);
		}

		const igUserId = integration.metadata?.instagramAccountId as
			| string
			| undefined;
		const accessToken = integration.config?.accessToken as
			| string
			| undefined;
		const pageId = integration.metadata?.pageId as
			| string
			| null
			| undefined;

		if (!igUserId || !accessToken) {
			throw new CustomError(
				`Instagram integration incomplete for business ${businessId}`,
				HttpStatusCode.BadRequest
			);
		}

		return { igUserId, accessToken, pageId: pageId || null };
	}
}

export const instagramPostService = new InstagramPostService();
