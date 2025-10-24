import type { Express } from 'express'; // Para tipar req.files
import { Types } from 'mongoose';
import models from '../models'; // Importamos el índice de modelos
import CustomError from '../errors/customError.error'; // Asumo que tienes esto
import { HttpStatusCode } from 'axios';
import { cloudinaryService } from './cloudinary.service'; // Importamos el servicio A
import { 
  facebookService, 
  CreatePhotoPayload, 
  CarouselPostPayload, // Asegúrate que esta interfaz esté definida en facebook.service.ts
  CreatePostResponse, 
  CreatePhotoResponse 
} from './facebook.service'; // Importamos el servicio B y sus tipos

// Interfaz para el payload de datos que viene del controlador (body)
interface PostPayloadData {
  message?: string;
  published?: boolean;
  scheduled_publish_time?: number | string;
}

// Interfaz para la respuesta unificada que devolverá este servicio
interface PublishResult {
  type: 'photo' | 'carousel';
  data: CreatePhotoResponse | CreatePostResponse; // Respuesta de Facebook
}

export interface CreateVideoPayload {
    file_url: string;
    description?: string;
    title?: string;
    published?: boolean;
    scheduled_publish_time?: number | string;
}
// Ejemplo de cómo podría ser la respuesta del servicio de Facebook
export interface CreateVideoResponse {
    id: string; // ID del video
}
interface VideoPayloadData {
  message?: string; // <-- AÑADIDO (o usa description directamente)
  description?: string; 
  title?: string;
  published?: boolean;
  scheduled_publish_time?: number | string;
}

// --- NUEVA INTERFAZ PARA RESPUESTA DE VIDEO ---
interface PublishVideoResult {
  type: 'video';
  data: { video_id: string; post_id?: string }; // ¿Quieres mantener 'video_id' aquí?
}

export class FacebookPostService {
  
  /**
   * Orquesta la creación completa de un post de foto(s) en Facebook.
   * Este es el ÚNICO método que llamará el controlador.
   * * @param businessId ID del negocio
   * @param payloadData Datos del body (message, etc.)
   * @param files Array de archivos de imagen (de multer)
   * @returns El resultado de la publicación (tipo y datos de Facebook)
   */
  async publishPhotoPost(
    businessId: string, 
    payloadData: PostPayloadData, 
    files: Express.Multer.File[]
  ): Promise<PublishResult> {
    
    // --- PASO 1: OBTENER CREDENCIALES (Lógica movida del controlador) ---
    console.log(`[FBPostService] Obteniendo credenciales para businessId: ${businessId}`);
    const integration = await models.integration.findOne({ 
      business: businessId, 
      type: 'meta',
      isConnected: true 
    }).select('+config.accessToken');

    if (!integration || !integration.config.accessToken || !integration.metadata?.pageId) {
      throw new CustomError('Active Facebook integration not found or is incomplete', HttpStatusCode.NotFound);
    }
    const pageAccessToken = integration.config.accessToken;
    const pageId = integration.metadata.pageId;
    console.log(`[FBPostService] Credenciales obtenidas para Page ID: ${pageId}`);

    // --- PASO 2: SUBIR A CLOUDINARY (Lógica movida del controlador) ---
    console.log(`[FBPostService] Subiendo ${files.length} archivo(s) a Cloudinary...`);
    const uploadPromises = files.map(file => 
      cloudinaryService.uploadImage(file.buffer) 
    );
    const cloudinaryResults = await Promise.all(uploadPromises);
    console.log(`[FBPostService] ${cloudinaryResults.length} archivo(s) subidos a Cloudinary.`);

    // --- PASO 3: LÓGICA DE PUBLICACIÓN EN FACEBOOK (Lógica movida del controlador) ---
    const { message, published, scheduled_publish_time } = payloadData;
    if (cloudinaryResults.length === 1) {
      // --- Lógica de FOTO ÚNICA ---
      console.log(`[FBPostService] Preparando publicación de FOTO ÚNICA...`);
      const payload: CreatePhotoPayload = {
        url: cloudinaryResults[0].secure_url, 
        message,
        published,
        scheduled_publish_time
      };

      // Llamamos al método específico de facebookService
      const result = await facebookService.createPagePhotoPost(pageAccessToken, pageId, payload);
      return { type: 'photo', data: result };

    } else {
      // --- Lógica de CARRUSEL ---
      console.log(`[FBPostService] Preparando publicación de CARRUSEL (${cloudinaryResults.length} fotos)...`);

      // 3a: Subir fotos a FB como no publicadas (usando facebookService)
      const fbUploadPromises = cloudinaryResults.map(upload => 
        facebookService.uploadUnpublishedPhoto(pageAccessToken, pageId, { url: upload.secure_url })
      );
      const fbUploadResults = await Promise.all(fbUploadPromises);
      
      // 3b: Preparar attached_media
      const attachedMedia = fbUploadResults.map(result => ({ media_fbid: result.id }));

      // 3c: Crear el post final (usando facebookService)
      const payload: CarouselPostPayload = {
        message,
        attached_media: attachedMedia
      };

      const result = await facebookService.publishCarouselPost(pageAccessToken, pageId, payload);
      return { type: 'carousel', data: result };
    }
  }
/**
   * =============================================================
   * MÉTODO COMPLETO PARA VIDEOS
   * =============================================================
   * Orquesta la creación completa de un post de VIDEO en Facebook.
   * Incluye: Obtener credenciales, subir a Cloudinary, y publicar en Facebook.
   * * @param businessId ID del negocio
   * @param payloadData Datos del body (description, title, etc.)
   * @param file El archivo de video (de multer)
   * @returns El resultado de la publicación del video.
   */
  async publishVideoPost(
    businessId: string,
    payloadData: VideoPayloadData,
    file: Express.Multer.File // Expecting a single file from multer.single('video')
  ): Promise<PublishVideoResult> { // Uses the specific video result interface

    // --- PASO 1: OBTENER CREDENCIALES ---
    console.log(`[FBPostService] Getting credentials for video post (businessId: ${businessId})`);
    const integration = await models.integration.findOne({
      business: businessId, type: 'meta', isConnected: true
    }).select('+config.accessToken');

    if (!integration || !integration.config.accessToken || !integration.metadata?.pageId) {
      throw new CustomError('Active Facebook integration not found or is incomplete', HttpStatusCode.NotFound);
    }
    const pageAccessToken = integration.config.accessToken;
    const pageId = integration.metadata.pageId;
    console.log(`[FBPostService] Credentials obtained for Page ID: ${pageId}`);

    // --- PASO 2: SUBIR VIDEO A CLOUDINARY ---
    console.log(`[FBPostService] Uploading VIDEO to Cloudinary...`);
    // Use the specific uploadVideo method from cloudinaryService
    const cloudinaryResult = await cloudinaryService.uploadVideo(file.buffer, 'facebook-videos'); // Specify video folder
    console.log(`[FBPostService] Video uploaded to Cloudinary. URL: ${cloudinaryResult.secure_url}`);

    // --- PASO 3: LÓGICA DE PUBLICACIÓN DE VIDEO EN FACEBOOK ---
    console.log(`[FBPostService] Preparing VIDEO post for Facebook...`);
    // Extract data, including 'message' for fallback
    const { message, description, title, published, scheduled_publish_time } = payloadData;

    // Prepare payload for facebookService.createPageVideoPost
    const videoPayload: CreateVideoPayload = { // Ensure this interface exists in facebook.service.ts
        file_url: cloudinaryResult.secure_url, // URL from Cloudinary
        description: description || message || '', // Use description first, fallback to message
        title: title,
        published: published,
        scheduled_publish_time: scheduled_publish_time
    };

    // Call the facebookService method to post the video using the URL
    // Ensure facebookService has createPageVideoPost returning { id: string }
    const result = await facebookService.createPageVideoPost(pageAccessToken, pageId, videoPayload);

    console.log(`[FBPostService] Video uploaded to Facebook with ID: ${result.id}`);

    // Adapt the result to the PublishVideoResult interface
    return { type: 'video', data: { video_id: result.id } }; // Map facebook's 'id' to our 'video_id'
  }

} // Fin de la clase


// Exportamos una instancia singleton
export const facebookPostService = new FacebookPostService();