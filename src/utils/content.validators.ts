import type { Response } from 'express';
import { Types } from 'mongoose';
import { HttpStatusCode } from 'axios';
import models from '../models';
import type { AuthRequest } from '../types/AuthRequest';

/**
 * Validate content ID format
 */
export function validateContentId(contentId: string, res: Response): boolean {
  if (!Types.ObjectId.isValid(contentId)) {
    res.status(HttpStatusCode.BadRequest).send({
      message: "Invalid content ID format."
    });
    return false;
  }
  return true;
}

/**
 * Validate business ID format
 */
export function validateBusinessId(businessId: string, res: Response): boolean {
  if (!Types.ObjectId.isValid(businessId)) {
    res.status(HttpStatusCode.BadRequest).send({
      message: "Invalid business ID format."
    });
    return false;
  }
  return true;
}

/**
 * Validate user authentication
 */
export function validateUserAuth(req: AuthRequest, res: Response): boolean {
  if (!req.user) {
    res.status(HttpStatusCode.Unauthorized).send({
      message: "User authentication required."
    });
    return false;
  }
  return true;
}

/**
 * Validate script type
 */
export function validateScriptType(scriptType: string, res: Response): boolean {
  if (!scriptType || !['content', 'ad'].includes(scriptType)) {
    res.status(HttpStatusCode.BadRequest).send({
      message: "Script type must be 'content' or 'ad'."
    });
    return false;
  }
  return true;
}

/**
 * Validate content project exists
 */
export async function validateContentExists(contentId: string, res: Response) {
  const content = await models.content.findById(contentId);
  if (!content) {
    res.status(HttpStatusCode.NotFound).send({
      message: "Content project not found."
    });
    return null;
  }
  return content;
}

/**
 * Validate business exists and user ownership
 */
export async function validateBusinessExists(businessId: string, res: Response) {
  const business = await models.business.findById(businessId);
  if (!business) {
    res.status(HttpStatusCode.NotFound).send({
      message: "Business not found."
    });
    return null;
  }
  return business;
}

/**
 * Validate content ownership through business
 */
export async function validateContentOwnership(content: any, userId: string, res: Response) {
  const business = await models.business.findOne({
    _id: content.business,
    owner: userId
  });

  if (!business) {
    res.status(HttpStatusCode.Forbidden).send({
      message: "Access denied to this content project."
    });
    return null;
  }
  return business;
}

/**
 * Validate business ownership
 */
export async function validateBusinessOwnership(businessId: string, userId: string, res: Response) {
  const business = await models.business.findOne({
    _id: businessId,
    owner: userId
  });

  if (!business) {
    res.status(HttpStatusCode.Forbidden).send({
      message: "Access denied to this business."
    });
    return null;
  }
  return business;
}

/**
 * Validate soundbites and taglines exist
 */
export function validateSoundbitesAndTaglines(content: any, res: Response): boolean {
  if (content.soundbites.length === 0 || content.taglines.length === 0) {
    res.status(HttpStatusCode.BadRequest).send({
      message: "Please generate soundbites and taglines first."
    });
    return false;
  }
  return true;
}

/**
 * Validate soundbites and taglines are available
 */
export function validateSoundbitesTaglinesAvailable(soundbite: string, tagline: string, res: Response): boolean {
  if (!soundbite || !tagline) {
    res.status(HttpStatusCode.BadRequest).send({
      message: "No soundbites or taglines available. Please generate them first."
    });
    return false;
  }
  return true;
}

/**
 * Validate script exists
 */
export function validateScriptExists(content: any, scriptId: string, res: Response) {
  const script = content.scripts.id(scriptId);
  if (!script) {
    res.status(HttpStatusCode.NotFound).send({
      message: "Script not found."
    });
    return null;
  }
  return script;
}

/**
 * Validate pagination parameters
 */
export function validatePaginationParams(page?: string, limit?: string) {
  const pageNum = parseInt(page || '1', 10);
  const limitNum = parseInt(limit || '10', 10);
  
  return {
    page: Math.max(1, pageNum),
    limit: Math.min(Math.max(1, limitNum), 100) // Max 100 items per page
  };
}