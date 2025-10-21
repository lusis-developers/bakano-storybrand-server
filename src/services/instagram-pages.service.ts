import axios from 'axios';
import CustomError from '../errors/customError.error';

const FB_GRAPH_VERSION = process.env.FACEBOOK_API_VERSION || 'v23.0';
const FB_GRAPH = `https://graph.facebook.com/${FB_GRAPH_VERSION}`;

export interface LinkedInstagramAccount {
  pageId: string;
  pageName: string;
  pageAccessToken: string;
  instagramAccountId: string;
  instagramUsername?: string;
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
      try {
        const igUrl = `${FB_GRAPH}/${instagramAccountId}`;
        const igResp = await axios.get(igUrl, { params: { fields: 'username', access_token: pageAccessToken } });
        instagramUsername = igResp.data?.username;
      } catch {
        instagramUsername = undefined;
      }
      accounts.push({
        pageId: page.id,
        pageName: page.name,
        pageAccessToken,
        instagramAccountId,
        instagramUsername,
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