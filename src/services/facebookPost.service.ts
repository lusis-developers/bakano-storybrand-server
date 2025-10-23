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
      cloudinaryService.uploadImage(file.buffer, 'facebook-posts') 
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
}

// Exportamos una instancia singleton
export const facebookPostService = new FacebookPostService();