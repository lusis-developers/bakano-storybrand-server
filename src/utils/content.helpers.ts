import type { ITaglineGeneration, ContentService } from '../services/content.service';
import type { IScript } from '../models/content.model';

/**
 * Map tagline style from service to model format
 */
export function mapTaglineStyle(serviceStyle: ITaglineGeneration['style']): 'professional' | 'casual' | 'creative' | 'direct' {
  switch (serviceStyle) {
    case 'professional': return 'professional';
    case 'emotional': return 'casual';
    case 'catchy': return 'creative';
    case 'action-oriented': return 'direct';
    default: return 'professional';
  }
}

/**
 * Generate soundbites and taglines for content
 */
export async function generateContentSoundbitesAndTaglines(
  contentService: ContentService,
  questions: any,
  tone: string
) {
  const generatedContent = await contentService.generateSoundbitesAndTaglines(
    questions,
    tone
  );

  const soundbites = generatedContent.soundbites.map(sb => ({
    text: sb.text,
    category: sb.category,
    selected: false
  }));

  const taglines = generatedContent.taglines.map(tl => ({
    text: tl.text,
    style: mapTaglineStyle(tl.style),
    selected: false
  }));

  return { soundbites, taglines };
}

/**
 * Generate script for content
 */
export async function generateContentScript(
  contentService: ContentService,
  questions: any,
  scriptType: 'content' | 'ad',
  soundbite: string,
  tagline: string,
  platform: string | undefined,
  tone: string,
  customText?: string
) {
  return await contentService.generateScript(
    questions,
    scriptType,
    soundbite,
    tagline,
    platform,
    tone,
    customText
  );
}

/**
 * Create script object for saving to database
 */
export function createScriptObject(
  scriptType: 'content' | 'ad',
  generatedScript: any,
  platform?: string,
  selectedSoundbite?: string,
  selectedTagline?: string
): Partial<IScript> {
  // Validate platform if provided
  const validPlatforms = ['youtube', 'instagram', 'tiktok', 'email', 'website', 'social'] as const;
  const validatedPlatform = platform && validPlatforms.includes(platform as any) 
    ? platform as 'youtube' | 'instagram' | 'tiktok' | 'email' | 'website' | 'social'
    : undefined;

  return {
    type: scriptType,
    title: generatedScript.title,
    content: generatedScript.content,
    duration: generatedScript.duration,
    platform: validatedPlatform,
    selectedSoundbite,
    selectedTagline,
    completed: false,
    generatedAt: new Date()
  };
}

/**
 * Get soundbite and tagline from content or use selected ones
 */
export function getSoundbiteAndTagline(
  content: any,
  selectedSoundbite?: string,
  selectedTagline?: string
) {
  const soundbite = selectedSoundbite || content.soundbites[0]?.text;
  const tagline = selectedTagline || content.taglines[0]?.text;
  
  return { soundbite, tagline };
}

/**
 * Build pagination query for database
 */
export function buildPaginationQuery(page: number, limit: number) {
  const skip = (page - 1) * limit;
  return { skip, limit };
}

/**
 * Build filter query for content projects
 */
export function buildContentFilterQuery(userId: string, businessId?: string) {
  const baseQuery: any = {};
  
  if (businessId) {
    baseQuery.business = businessId;
  }
  
  // We'll add the business ownership check in the aggregation pipeline
  return baseQuery;
}

/**
 * Format content response with pagination info
 */
export function formatContentResponse(
  content: any[],
  total: number,
  page: number,
  limit: number
) {
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;
  
  return {
    content,
    pagination: {
      currentPage: page,
      totalPages,
      totalItems: total,
      itemsPerPage: limit,
      hasNextPage,
      hasPrevPage
    }
  };
}

/**
 * Format script response
 */
export function formatScriptResponse(scripts: any[], message: string = "Scripts retrieved successfully.") {
  return {
    message,
    scripts,
    count: scripts.length
  };
}

/**
 * Build business lookup pipeline for aggregation
 */
export function buildBusinessLookupPipeline(userId: string) {
  return [
    {
      $lookup: {
        from: 'businesses',
        localField: 'business',
        foreignField: '_id',
        as: 'businessInfo'
      }
    },
    {
      $match: {
        'businessInfo.owner': userId
      }
    },
    {
      $project: {
        businessInfo: 0 // Remove the lookup field from final result
      }
    }
  ];
}

/**
 * Validate and sanitize script filters
 */
export function validateScriptFilters(filters: any) {
  const validFilters: any = {};
  
  if (filters.type && ['content', 'ad'].includes(filters.type)) {
    validFilters['scripts.type'] = filters.type;
  }
  
  if (filters.platform && ['email', 'website', 'youtube', 'social'].includes(filters.platform)) {
    validFilters['scripts.platform'] = filters.platform;
  }
  
  if (filters.completed !== undefined) {
    validFilters['scripts.completed'] = filters.completed === 'true' || filters.completed === true;
  }
  
  return validFilters;
}