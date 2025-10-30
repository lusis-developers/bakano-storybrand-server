import axios from 'axios';
import CustomError from '../errors/customError.error';

/**
 * NOTA IMPORTANTE SOBRE FOTOS DE PERFIL DE INSTAGRAM
 * --------------------------------------------------
 * A diferencia de las Páginas de Facebook (que permiten una URL de redirección estable
 * del tipo https://graph.facebook.com/{PAGE_ID}/picture), Instagram NO expone un endpoint
 * de "picture" permanente. Para cuentas Business/Creator, la forma correcta es:
 *
 * 1) Guardar el ID de la cuenta de Instagram (comienza con 178...)
 * 2) Cuando necesites mostrar la foto, llamar a: GET /{IG_ID}?fields=profile_picture_url
 * 3) La URL devuelta es temporal (puede expirar). Si necesitas optimizar,
 *    puedes cachearla por unas horas.
 *
 * En este servicio:
 * - listLinkedInstagramAccounts obtiene las páginas con IG vinculado y puede enriquecer con
 *   username, profile_picture_url y followers_count para mostrar en el flujo de conexión.
 * - getInstagramProfilePictureUrl(igId, accessToken) permite obtener una URL "fresca"
 *   bajo demanda cuando el frontend la necesite.
 */

const FB_GRAPH_VERSION = process.env.FACEBOOK_API_VERSION || 'v23.0';
const FB_GRAPH = `https://graph.facebook.com/${FB_GRAPH_VERSION}`;

export interface LinkedInstagramAccount {
  pageId: string;
  pageName: string;
  pageAccessToken: string;
  instagramAccountId: string;
  instagramUsername?: string;
  instagramProfilePictureUrl?: string;
  followersCount?: number;
}

/**
 * Lista todas las páginas de Facebook del usuario que tienen una cuenta de Instagram Business vinculada.
 * Requiere un token de USUARIO de Facebook (EAA...) con permisos pages_show_list e instagram_basic.
 */
export async function listLinkedInstagramAccounts(userAccessToken: string): Promise<LinkedInstagramAccount[]> {
  if (!userAccessToken) throw new CustomError('Missing userAccessToken', 400);

  const url = `${FB_GRAPH}/me/accounts`;
  const params = {
    fields: 'id,name,access_token,instagram_business_account',
    access_token: userAccessToken,
    limit: 100,
  };

  try {
    const pagesResp = await axios.get<{ data: any[] }>(url, { params });
    const pages = pagesResp.data?.data || [];
    const withIg = pages.filter(p => p.instagram_business_account?.id && p.access_token);

    const accounts: LinkedInstagramAccount[] = [];
    for (const page of withIg) {
      const instagramAccountId = page.instagram_business_account.id as string;
      const pageAccessToken = page.access_token as string;
      let instagramUsername: string | undefined;
      let instagramProfilePictureUrl: string | undefined;
      let followersCount: number | undefined;
      try {
        const igUrl = `${FB_GRAPH}/${instagramAccountId}`;
        const igResp = await axios.get(igUrl, { params: { fields: 'username,profile_picture_url,followers_count', access_token: pageAccessToken } });
        instagramUsername = igResp.data?.username;
        instagramProfilePictureUrl = igResp.data?.profile_picture_url;
        followersCount = igResp.data?.followers_count;
      } catch {
        instagramUsername = undefined;
        instagramProfilePictureUrl = undefined;
        followersCount = undefined;
      }
      accounts.push({
        pageId: page.id,
        pageName: page.name,
        pageAccessToken,
        instagramAccountId,
        instagramUsername,
        instagramProfilePictureUrl,
        followersCount,
      });
    }
    return accounts;
  } catch (error: any) {
    const message = error?.response?.data?.error?.message || error?.message || 'Error listing linked Instagram accounts';
    throw new CustomError(message, error?.response?.status || 500, error?.response?.data);
  }
}

/**
 * Busca los detalles de IG vinculados a una pageId específica usando el token de USUARIO.
 */
export async function getLinkedInstagramByPageId(userAccessToken: string, pageId: string): Promise<LinkedInstagramAccount | null> {
  const all = await listLinkedInstagramAccounts(userAccessToken);
  return all.find(a => a.pageId === pageId) || null;
}

/**
 * Devuelve una URL "fresca" de la foto de perfil de una cuenta de Instagram Business/Creator.
 * IMPORTANTE: Esta URL es temporal. Úsala directamente en el frontend o cachea por unas horas.
 */
export async function getInstagramProfilePictureUrl(
  instagramAccountId: string,
  accessToken: string
): Promise<string | undefined> {
  if (!instagramAccountId) throw new CustomError('Missing instagramAccountId', 400);
  if (!accessToken) throw new CustomError('Missing accessToken', 400);

  try {
    const url = `${FB_GRAPH}/${instagramAccountId}`;
    const resp = await axios.get(url, {
      params: {
        fields: 'profile_picture_url',
        access_token: accessToken,
      }
    });
    return resp.data?.profile_picture_url;
  } catch (error: any) {
    const message = error?.response?.data?.error?.message || error?.message || 'Error fetching Instagram profile picture URL';
    throw new CustomError(message, error?.response?.status || 500, error?.response?.data);
  }
}