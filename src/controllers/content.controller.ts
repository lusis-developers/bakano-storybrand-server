import type { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import models from '../models';
import { HttpStatusCode } from 'axios';
import type { AuthRequest } from '../types/AuthRequest';
import { ContentService, type ITaglineGeneration } from '../services/content.service';

/**
 * Helper function to map tagline styles from service to model
 */
function mapTaglineStyle(serviceStyle: ITaglineGeneration['style']): 'professional' | 'casual' | 'creative' | 'direct' {
  const styleMap: Record<ITaglineGeneration['style'], 'professional' | 'casual' | 'creative' | 'direct'> = {
    'catchy': 'creative',
    'professional': 'professional',
    'emotional': 'casual',
    'action-oriented': 'direct'
  };
  return styleMap[serviceStyle] || 'professional';
}

/**
 * Create a new content project for a business
 */
export async function createContentProject(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { businessId } = req.params;
    const { questions, tone = 'professional', aiProvider = 'gemini' } = req.body;

    // Validate business ID
    if (!Types.ObjectId.isValid(businessId)) {
      res.status(HttpStatusCode.BadRequest).send({
        message: "Invalid business ID format."
      });
      return;
    }

    if (!req.user) {
      res.status(HttpStatusCode.Unauthorized).send({
        message: "User authentication required."
      });
      return;
    }

    // Verify business exists and belongs to user
    const business = await models.business.findOne({
      _id: businessId,
      user: req.user.id
    });

    if (!business) {
      res.status(HttpStatusCode.NotFound).send({
        message: "Business not found or access denied."
      });
      return;
    }

    // Check if content project already exists for this business
    const existingContent = await models.content.findOne({ business: businessId });
    if (existingContent) {
      res.status(HttpStatusCode.Conflict).send({
        message: "Content project already exists for this business.",
        contentId: existingContent._id
      });
      return;
    }

    // Create new content project
    const content = new models.content({
      business: businessId,
      questions,
      tone,
      aiProvider,
      status: 'draft'
    });

    await content.save();

    res.status(HttpStatusCode.Created).send({
      message: "Content project created successfully.",
      content
    });
    return;

  } catch (error) {
    console.error('Error creating content project:', error);
    next(error);
  }
}

/**
 * Get content project by business ID
 */
export async function getContentByBusiness(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { businessId } = req.params;

    // Validate business ID
    if (!Types.ObjectId.isValid(businessId)) {
      res.status(HttpStatusCode.BadRequest).send({
        message: "Invalid business ID format."
      });
      return;
    }

    // Find content project
    const content = await models.content.findOne({ business: businessId })
      .populate('business', 'name industry');

    if (!content) {
      res.status(HttpStatusCode.NotFound).send({
        message: "Content project not found for this business."
      });
      return;
    }

    if (!req.user) {
      res.status(HttpStatusCode.Unauthorized).send({
        message: "User authentication required."
      });
      return;
    }

    // Verify business belongs to user
    const business = await models.business.findOne({
      _id: businessId,
      user: req.user.id
    });

    if (!business) {
      res.status(HttpStatusCode.Forbidden).send({
        message: "Access denied to this business."
      });
      return;
    }

    res.status(HttpStatusCode.Ok).send({
      message: "Content project retrieved successfully.",
      content
    });
    return;

  } catch (error) {
    console.error('Error retrieving content project:', error);
    next(error);
  }
}

/**
 * Update business questions
 */
export async function updateQuestions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { contentId } = req.params;
    const { questions } = req.body;

    // Validate content ID
    if (!Types.ObjectId.isValid(contentId)) {
      res.status(HttpStatusCode.BadRequest).send({
        message: "Invalid content ID format."
      });
      return;
    }

    // Find content project
    const content = await models.content.findById(contentId).populate('business');
    if (!content) {
      res.status(HttpStatusCode.NotFound).send({
        message: "Content project not found."
      });
      return;
    }

    if (!req.user) {
      res.status(HttpStatusCode.Unauthorized).send({
        message: "User authentication required."
      });
      return;
    }

    // Verify business belongs to user
    const business = await models.business.findOne({
      _id: content.business,
      user: req.user.id
    });

    if (!business) {
      res.status(HttpStatusCode.Forbidden).send({
        message: "Access denied to this content project."
      });
      return;
    }

    // Update questions
    content.questions = { ...content.questions, ...questions };
    await content.save();

    res.status(HttpStatusCode.Ok).send({
      message: "Questions updated successfully.",
      content
    });
    return;

  } catch (error) {
    console.error('Error updating questions:', error);
    next(error);
  }
}

/**
 * Generate soundbites and taglines based on business questions
 */
export async function generateSoundbitesAndTaglines(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { contentId } = req.params;
    const { regenerate = false } = req.body;

    // Validate content ID
    if (!Types.ObjectId.isValid(contentId)) {
      res.status(HttpStatusCode.BadRequest).send({
        message: "Invalid content ID format."
      });
      return;
    }

    // Find content project
    const content = await models.content.findById(contentId);
    if (!content) {
      res.status(HttpStatusCode.NotFound).send({
        message: "Content project not found."
      });
      return;
    }

    if (!req.user) {
      res.status(HttpStatusCode.Unauthorized).send({
        message: "User authentication required."
      });
      return;
    }

    // Verify business belongs to user
    const business = await models.business.findOne({
      _id: content.business,
      user: req.user.id
    });

    if (!business) {
      res.status(HttpStatusCode.Forbidden).send({
        message: "Access denied to this content project."
      });
      return;
    }

    // Check if questions are complete
    if (!(content as any).isQuestionsComplete()) {
      res.status(HttpStatusCode.BadRequest).send({
        message: "Please complete all business questions before generating content."
      });
      return;
    }

    // Check if already generated and not regenerating
    if (content.soundbites.length > 0 && content.taglines.length > 0 && !regenerate) {
      res.status(HttpStatusCode.Ok).send({
        message: "Soundbites and taglines already generated.",
        soundbites: content.soundbites,
        taglines: content.taglines
      });
      return;
    }

    // Generate content using ContentService
    const contentService = new ContentService(content.aiProvider);
    const generatedContent = await contentService.generateSoundbitesAndTaglines(
      content.questions,
      content.tone
    );

    // Clear existing content if regenerating
    if (regenerate) {
      content.soundbites = [];
      content.taglines = [];
    }

    // Add generated soundbites
    if (generatedContent.soundbites) {
      content.soundbites.push(...generatedContent.soundbites.map(sb => ({
        text: sb.text,
        category: sb.category,
        generatedAt: new Date()
      })));
    }

    // Add generated taglines
    if (generatedContent.taglines) {
      content.taglines.push(...generatedContent.taglines.map((tl: ITaglineGeneration) => ({
        text: tl.text,
        style: mapTaglineStyle(tl.style),
        generatedAt: new Date()
      })));
    }

    await content.save();

    res.status(HttpStatusCode.Ok).send({
      message: "Soundbites and taglines generated successfully.",
      soundbites: content.soundbites,
      taglines: content.taglines
    });
    return;

  } catch (error) {
    console.error('Error generating soundbites and taglines:', error);
    next(error);
  }
}

/**
 * Generate scripts for content and ads
 */
export async function generateScripts(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { contentId } = req.params;
    const { scriptType, platform, selectedSoundbite, selectedTagline } = req.body;

    // Validate content ID
    if (!Types.ObjectId.isValid(contentId)) {
      res.status(HttpStatusCode.BadRequest).send({
        message: "Invalid content ID format."
      });
      return;
    }

    // Validate required fields
    if (!scriptType || !['content', 'ad'].includes(scriptType)) {
      res.status(HttpStatusCode.BadRequest).send({
        message: "Script type must be 'content' or 'ad'."
      });
      return;
    }

    // Find content project
    const content = await models.content.findById(contentId);
    if (!content) {
      res.status(HttpStatusCode.NotFound).send({
        message: "Content project not found."
      });
      return;
    }

    if (!req.user) {
      res.status(HttpStatusCode.Unauthorized).send({
        message: "User authentication required."
      });
      return;
    }

    // Verify business belongs to user
    const business = await models.business.findOne({
      _id: content.business,
      user: req.user.id
    });

    if (!business) {
      res.status(HttpStatusCode.Forbidden).send({
        message: "Access denied to this content project."
      });
      return;
    }

    // Check if soundbites and taglines exist
    if (content.soundbites.length === 0 || content.taglines.length === 0) {
      res.status(HttpStatusCode.BadRequest).send({
        message: "Please generate soundbites and taglines first."
      });
      return;
    }

    // Generate script using ContentService
    const contentService = new ContentService(content.aiProvider);
    
    const soundbite = selectedSoundbite || content.soundbites[0]?.text;
    const tagline = selectedTagline || content.taglines[0]?.text;

    if (!soundbite || !tagline) {
      res.status(HttpStatusCode.BadRequest).send({
        message: "No soundbites or taglines available. Please generate them first."
      });
      return;
    }

    const generatedScript = await contentService.generateScript(
      content.questions,
      scriptType,
      soundbite,
      tagline,
      platform,
      content.tone
    );

    // Add script to content
    const newScript = {
      type: scriptType,
      title: generatedScript.title,
      content: generatedScript.content,
      duration: generatedScript.duration,
      platform: platform || undefined,
      generatedAt: new Date()
    };

    content.scripts.push(newScript);
    await content.save();

    res.status(HttpStatusCode.Created).send({
      message: "Script generated successfully.",
      script: newScript
    });
    return;

  } catch (error) {
    console.error('Error generating script:', error);
    next(error);
  }
}

/**
 * Get all content projects for user
 */
export async function getUserContentProjects(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    // Build query
    const query: any = {};
    if (status) {
      query.status = status;
    }

    if (!req.user) {
      res.status(HttpStatusCode.Unauthorized).send({
        message: "User authentication required."
      });
      return;
    }

    // Get user's businesses
    const userBusinesses = await models.business.find({ user: req.user.id }).select('_id');
    const businessIds = userBusinesses.map((b: any) => b._id);

    query.business = { $in: businessIds };

    // Execute query with pagination
    const [contentProjects, total] = await Promise.all([
      models.content.find(query)
        .populate('business', 'name industry')
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit)),
      models.content.countDocuments(query)
    ]);

    res.status(HttpStatusCode.Ok).send({
      message: "Content projects retrieved successfully.",
      contentProjects,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
    return;

  } catch (error) {
    console.error('Error retrieving content projects:', error);
    next(error);
  }
}

/**
 * Delete content project
 */
export async function deleteContentProject(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { contentId } = req.params;

    // Validate content ID
    if (!Types.ObjectId.isValid(contentId)) {
      res.status(HttpStatusCode.BadRequest).send({
        message: "Invalid content ID format."
      });
      return;
    }

    // Find content project
    const content = await models.content.findById(contentId);
    if (!content) {
      res.status(HttpStatusCode.NotFound).send({
        message: "Content project not found."
      });
      return;
    }

    if (!req.user) {
      res.status(HttpStatusCode.Unauthorized).send({
        message: "User authentication required."
      });
      return;
    }

    // Verify business belongs to user
    const business = await models.business.findOne({
      _id: content.business,
      user: req.user.id
    });

    if (!business) {
      res.status(HttpStatusCode.Forbidden).send({
        message: "Access denied to this content project."
      });
      return;
    }

    await models.content.findByIdAndDelete(contentId);

    res.status(HttpStatusCode.Ok).send({
      message: "Content project deleted successfully."
    });
    return;

  } catch (error) {
    console.error('Error deleting content project:', error);
    next(error);
  }
}