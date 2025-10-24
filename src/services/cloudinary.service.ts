import { v2 as cloudinary, UploadApiResponse, ConfigOptions } from "cloudinary";
import CustomError from "../errors/customError.error";
import { HttpStatusCode } from "axios";
import { Readable } from "stream";

export interface CloudinaryUploadResult {
	secure_url: string;
	public_id: string;
	format: string;
	width: number;
	height: number;
}

export interface CloudinaryUploadVideoResult {
	secure_url: string;
	public_id: string;
	format: string;
	duration: number;
	width: number;
	height: number;
}

export class CloudinaryService {
	private config: ConfigOptions;

	constructor() {
		const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
		const apiKey = process.env.CLOUDINARY_API_KEY;
		const apiSecret = process.env.CLOUDINARY_API_SECRET;

		if (!cloudName || !apiKey || !apiSecret) {
			throw new Error(
				"Cloudinary configuration is incomplete. Missing CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, or CLOUDINARY_API_SECRET"
			);
		}

		this.config = {
			cloud_name: cloudName,
			api_key: apiKey,
			api_secret: apiSecret,
			secure: true,
		};

		cloudinary.config(this.config);
	}

	async uploadImage(
		fileBuffer: Buffer,
		folder: string = "userPosts"
	): Promise<CloudinaryUploadResult> {
		return new Promise<CloudinaryUploadResult>((resolve, reject) => {
			const uploadStream = cloudinary.uploader.upload_stream(
				{
					folder: folder,
					resource_type: "auto",
				},
				(error, result: UploadApiResponse | undefined) => {
					if (error) {
						return reject(
							new CustomError(
								error.message,
								HttpStatusCode.InternalServerError
							)
						);
					}

					if (!result) {
						return reject(
							new CustomError(
								"Cloudinary returned no result.",
								HttpStatusCode.InternalServerError
							)
						);
					}

					resolve({
						secure_url: result.secure_url,
						public_id: result.public_id,
						format: result.format,
						width: result.width,
						height: result.height,
					});
				}
			);

			const readableStream = new Readable();
			readableStream.push(fileBuffer);
			readableStream.push(null);

			readableStream.pipe(uploadStream);
		});
	}

	async uploadVideo(
		fileBuffer: Buffer,
		folder: string = "userVideos"
	): Promise<CloudinaryUploadVideoResult> {
		return new Promise<CloudinaryUploadVideoResult>((resolve, reject) => {
			const uploadStream = cloudinary.uploader.upload_stream(
				{
					folder: folder,
					resource_type: "video",
				},
				(error, result: UploadApiResponse | undefined) => {
					if (error) {
						return reject(
							new CustomError(
								error.message,
								HttpStatusCode.InternalServerError
							)
						);
					}

					if (!result) {
						return reject(
							new CustomError(
								"Cloudinary (video) returned no result.",
								HttpStatusCode.InternalServerError
							)
						);
					}

					resolve({
						secure_url: result.secure_url,
						public_id: result.public_id,
						format: result.format,
						duration: result.duration,
						width: result.width,
						height: result.height,
					});
				}
			);

			const readableStream = new Readable();
			readableStream.push(fileBuffer);
			readableStream.push(null);
			readableStream.pipe(uploadStream);
		});
	}

	async deleteImage(publicId: string): Promise<{ result: string }> {
		try {
			const result = await cloudinary.uploader.destroy(publicId);
			return result;
		} catch (error: any) {
			throw new CustomError(
				error.message,
				HttpStatusCode.InternalServerError
			);
		}
	}
}

export const cloudinaryService = new CloudinaryService();
