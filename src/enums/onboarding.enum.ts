/**
 * Enums para el proceso de onboarding de StoryBrand
 * Mantiene control sobre los strings y opciones disponibles
 */

// Pregunta 1: ¿Cuál describe mejor tu rol?
export enum UserRole {
  BUSINESS_OWNER = 'business_owner',
  MARKETING_AGENCY = 'marketing_agency',
  COACH_CONSULTANT = 'coach_consultant',
  ARTIST_CREATIVE = 'artist_creative',
  EMPLOYEE = 'employee'
}

// Sub-pregunta para Business Owner: ¿Qué tipo de negocio tienes?
export enum BusinessType {
  SERVICE_BASED = 'service_based',
  PRODUCT_BASED = 'product_based',
  ECOMMERCE = 'ecommerce',
  SAAS = 'saas',
  NON_PROFIT = 'non_profit'
}

// Pregunta 2: ¿Eres el creador principal de contenido de marketing?
export enum ContentCreatorType {
  PRIMARY_CREATOR = 'primary_creator',
  HAVE_TEAM_CONTRACTOR = 'have_team_contractor'
}

// Pregunta 3: ¿Qué esperas lograr con StoryBrand.ai?
export enum StoryBrandGoal {
  CLARIFY_BRAND_MESSAGE = 'clarify_brand_message',
  WRITE_MARKETING_CAMPAIGN = 'write_marketing_campaign',
  BUILD_CONVERTING_WEBSITE = 'build_converting_website',
  CREATE_SALES_COPY = 'create_sales_copy',
  GET_MORE_LEADS = 'get_more_leads',
  OTHER = 'other'
}

// Pregunta 4: ¿Qué tan familiarizado estás con el framework StoryBrand?
export enum StoryBrandFamiliarity {
  NEVER_HEARD = 'never_heard',
  HEARD_NOT_USED = 'heard_not_used',
  READ_BOOK = 'read_book',
  ATTENDED_WORKSHOP = 'attended_workshop',
  USE_REGULARLY = 'use_regularly'
}

// Pregunta 5: ¿Cómo estás comercializando actualmente a tus clientes?
export enum MarketingChannel {
  WEBSITE = 'website',
  EMAIL_MARKETING = 'email_marketing',
  SOCIAL_MEDIA = 'social_media',
  ADS = 'ads',
  LEAD_GENERATORS = 'lead_generators',
  BLOGS = 'blogs',
  TEXT_MESSAGING = 'text_messaging',
  YOUTUBE_VIDEOS = 'youtube_videos',
  DIRECT_MAIL = 'direct_mail',
  BROCHURES = 'brochures',
  BILLBOARDS = 'billboards'
}

// Labels en español para mostrar en el frontend
export const UserRoleLabels = {
  [UserRole.BUSINESS_OWNER]: 'Business Owner',
  [UserRole.MARKETING_AGENCY]: 'Marketing agency or freelancer',
  [UserRole.COACH_CONSULTANT]: 'Coach or consultant',
  [UserRole.ARTIST_CREATIVE]: 'Artist or creative',
  [UserRole.EMPLOYEE]: 'Employee'
} as const;

export const BusinessTypeLabels = {
  [BusinessType.SERVICE_BASED]: 'Service-based business',
  [BusinessType.PRODUCT_BASED]: 'Product-based business',
  [BusinessType.ECOMMERCE]: 'E-commerce',
  [BusinessType.SAAS]: 'SaaS',
  [BusinessType.NON_PROFIT]: 'Non-profit'
} as const;

export const ContentCreatorTypeLabels = {
  [ContentCreatorType.PRIMARY_CREATOR]: "I'm the primary marketing content creator",
  [ContentCreatorType.HAVE_TEAM_CONTRACTOR]: 'I have a team or contractor'
} as const;

export const StoryBrandGoalLabels = {
  [StoryBrandGoal.CLARIFY_BRAND_MESSAGE]: 'Clarify my brand message',
  [StoryBrandGoal.WRITE_MARKETING_CAMPAIGN]: 'Write a marketing campaign',
  [StoryBrandGoal.BUILD_CONVERTING_WEBSITE]: 'Build a website that converts',
  [StoryBrandGoal.CREATE_SALES_COPY]: 'Create sales copy that works',
  [StoryBrandGoal.GET_MORE_LEADS]: 'Get more leads or customers',
  [StoryBrandGoal.OTHER]: 'Other'
} as const;

export const StoryBrandFamiliarityLabels = {
  [StoryBrandFamiliarity.NEVER_HEARD]: 'Never heard of it',
  [StoryBrandFamiliarity.HEARD_NOT_USED]: "I've heard of it but haven't used it",
  [StoryBrandFamiliarity.READ_BOOK]: "I've read the book",
  [StoryBrandFamiliarity.ATTENDED_WORKSHOP]: "I've attended a workshop or course",
  [StoryBrandFamiliarity.USE_REGULARLY]: 'I use it regularly in my business'
} as const;

export const MarketingChannelLabels = {
  [MarketingChannel.WEBSITE]: 'Website',
  [MarketingChannel.EMAIL_MARKETING]: 'Email marketing',
  [MarketingChannel.SOCIAL_MEDIA]: 'Social media content',
  [MarketingChannel.ADS]: 'Ads',
  [MarketingChannel.LEAD_GENERATORS]: 'Lead generators',
  [MarketingChannel.BLOGS]: 'Blogs',
  [MarketingChannel.TEXT_MESSAGING]: 'Text messaging (SMS)',
  [MarketingChannel.YOUTUBE_VIDEOS]: 'YouTube videos',
  [MarketingChannel.DIRECT_MAIL]: 'Direct mail',
  [MarketingChannel.BROCHURES]: 'Brochures',
  [MarketingChannel.BILLBOARDS]: 'Billboards'
} as const;

// Tipos de utilidad para TypeScript
export type UserRoleType = keyof typeof UserRoleLabels;
export type BusinessTypeType = keyof typeof BusinessTypeLabels;
export type ContentCreatorTypeType = keyof typeof ContentCreatorTypeLabels;
export type StoryBrandGoalType = keyof typeof StoryBrandGoalLabels;
export type StoryBrandFamiliarityType = keyof typeof StoryBrandFamiliarityLabels;
export type MarketingChannelType = keyof typeof MarketingChannelLabels;