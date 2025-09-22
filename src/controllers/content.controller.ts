import type { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import models from '../models';
import { HttpStatusCode } from 'axios';
import type { AuthRequest } from '../types/AuthRequest';
import { ContentService, type ITaglineGeneration } from '../services/content.service';
import { sanitizeContentQuestions } from '../utils/content.util';
import {
  validateContentId,
  validateScriptType,
  validateUserAuth,
  validateContentExists,
  validateContentOwnership,
  validateSoundbitesAndTaglines,
  validateSoundbitesTaglinesAvailable
} from '../utils/content.validators';
import {
  mapTaglineStyle,
  generateContentSoundbitesAndTaglines,
  generateContentScript,
  createScriptObject,
  getSoundbiteAndTagline
} from '../utils/content.helpers';



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
      owner: req.user.id
    });

    if (!business) {
      res.status(HttpStatusCode.NotFound).send({
        message: "Business not found or access denied."
      });
      return;
    }

    // Check if content project already exists for this business
    const existingContent = await models.content.findOne({ business: businessId });
    
    let content;
     if (existingContent) {
       // Update existing content project
       const sanitizedQuestions = sanitizeContentQuestions(questions);
       existingContent.questions = sanitizedQuestions as any;
       existingContent.tone = tone;
       existingContent.aiProvider = aiProvider;
       existingContent.status = 'draft';
       
       // Clear existing generated content to allow regeneration
       existingContent.soundbites = [];
       existingContent.taglines = [];
       existingContent.scripts = [];
       
       content = await existingContent.save();
     } else {
      // Create new content project
      content = new models.content({
        business: businessId,
        questions: sanitizeContentQuestions(questions),
        tone,
        aiProvider,
        status: 'draft'
      });
      
      await content.save();
    }

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
 * Get user script statistics including business count and total scripts
 */
export async function getUserScriptStatistics(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      res.status(HttpStatusCode.Unauthorized).send({
        message: "User authentication required."
      });
      return;
    }

    const userId = req.user.id;
    const userBusinesses = await models.business.find({ owner: userId }).select('_id name');
    const businessIds = userBusinesses.map(business => business._id);

    if (businessIds.length === 0) {
      res.status(HttpStatusCode.Ok).send({
        message: "User script statistics retrieved successfully.",
        statistics: {
          totalBusinesses: 0,
          totalScripts: 0,
          scriptsByType: {
            content: 0,
            ad: 0
          },
          scriptsByPlatform: {},
          businesses: []
        }
      });
      return;
    }

    // Get all content projects for user's businesses
    const contentProjects = await models.content.find({ 
      business: { $in: businessIds } 
    }).populate('business', 'name');

    // Calculate statistics
    let totalScripts = 0;
    let contentScripts = 0;
    let adScripts = 0;
    const platformCounts: Record<string, number> = {};
    const businessStats: Array<{
      businessId: string;
      businessName: string;
      totalScripts: number;
      contentScripts: number;
      adScripts: number;
    }> = [];

    contentProjects.forEach(project => {
      const businessScripts = project.scripts || [];
      const businessContentScripts = businessScripts.filter(script => script.type === 'content').length;
      const businessAdScripts = businessScripts.filter(script => script.type === 'ad').length;
      const businessTotalScripts = businessScripts.length;

      totalScripts += businessTotalScripts;
      contentScripts += businessContentScripts;
      adScripts += businessAdScripts;

      // Count by platform
      businessScripts.forEach(script => {
        if (script.platform) {
          platformCounts[script.platform] = (platformCounts[script.platform] || 0) + 1;
        }
      });

      // Add business stats
      const business = project.business as any;
      businessStats.push({
        businessId: business._id.toString(),
        businessName: business.name,
        totalScripts: businessTotalScripts,
        contentScripts: businessContentScripts,
        adScripts: businessAdScripts
      });
    });

    res.status(HttpStatusCode.Ok).send({
      message: "User script statistics retrieved successfully.",
      statistics: {
        totalBusinesses: userBusinesses.length,
        totalScripts,
        scriptsByType: {
          content: contentScripts,
          ad: adScripts
        },
        scriptsByPlatform: platformCounts,
        businesses: businessStats
      }
    });
    return;

  } catch (error) {
    console.error('Error getting user script statistics:', error);
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
      owner: req.user.id
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
      owner: req.user.id
    });

    if (!business) {
      res.status(HttpStatusCode.Forbidden).send({
        message: "Access denied to this content project."
      });
      return;
    }

    // Update questions
    content.questions = { ...content.questions, ...sanitizeContentQuestions(questions) };
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
    if (!validateContentId(contentId, res)) return;

    // Validate user authentication
    if (!validateUserAuth(req, res)) return;

    // Validate content exists
    const content = await validateContentExists(contentId, res);
    if (!content) return;

    // Validate content ownership
    const business = await validateContentOwnership(content, req.user!.id, res);
    if (!business) return;

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

    // Clear existing content if regenerating
    if (regenerate) {
      content.soundbites = [];
      content.taglines = [];
    }

    // Generate content using helper function
    const contentService = new ContentService(content.aiProvider);
    const { soundbites, taglines } = await generateContentSoundbitesAndTaglines(
      contentService,
      content.questions,
      content.tone
    );

    // Add generated content with timestamps
    content.soundbites.push(...soundbites.map(sb => ({
      ...sb,
      generatedAt: new Date()
    })));

    content.taglines.push(...taglines.map(tl => ({
      ...tl,
      generatedAt: new Date()
    })));

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
    const { scriptType, platform, selectedSoundbite, selectedTagline, customText } = req.body;

    // Validate content ID
    if (!validateContentId(contentId, res)) return;

    // Validate script type
    if (!validateScriptType(scriptType, res)) return;

    // Validate user authentication
    if (!validateUserAuth(req, res)) return;

    // Validate content exists
    const content = await validateContentExists(contentId, res);
    if (!content) return;

    // Validate content ownership
    const business = await validateContentOwnership(content, req.user!.id, res);
    if (!business) return;

    // Validate soundbites and taglines exist
    if (!validateSoundbitesAndTaglines(content, res)) return;

    // Get soundbite and tagline
    const { soundbite, tagline } = getSoundbiteAndTagline(
      content,
      selectedSoundbite,
      selectedTagline
    );

    // Validate soundbites and taglines are available
    if (!validateSoundbitesTaglinesAvailable(soundbite, tagline, res)) return;

    // Generate script using ContentService
    const contentService = new ContentService(content.aiProvider);
    const generatedScript = await generateContentScript(
      contentService,
      content.questions,
      scriptType,
      soundbite,
      tagline,
      platform,
      content.tone,
      customText
    );

    // Create script object
    const newScript = createScriptObject(
      scriptType, 
      generatedScript, 
      platform,
      soundbite,
      tagline
    );

    // Add script to content
    content.scripts.push(newScript as any);
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
    const userBusinesses = await models.business.find({ owner: req.user.id }).select('_id');
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
 * Get all scripts from a content project
 */
export async function getScripts(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { contentId } = req.params;
    const { type, startDate, endDate, platform, completed } = req.query;

    // Validate content ID
    if (!Types.ObjectId.isValid(contentId)) {
      res.status(HttpStatusCode.BadRequest).send({
        message: "Invalid content ID format."
      });
      return;
    }

    if (!req.user) {
      res.status(HttpStatusCode.Unauthorized).send({
        message: "User authentication required."
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

    // Verify business belongs to user
    const business = await models.business.findOne({
      _id: content.business,
      owner: req.user.id
    });

    if (!business) {
      res.status(HttpStatusCode.Forbidden).send({
        message: "Access denied to this content project."
      });
      return;
    }

    // Apply filters to scripts
    let scripts = content.scripts || [];

    // Filter by type
    if (type && ['content', 'ad'].includes(type as string)) {
      scripts = scripts.filter(script => script.type === type);
    }

    // Filter by platform
    if (platform && ['youtube', 'instagram', 'tiktok', 'email', 'website', 'social'].includes(platform as string)) {
      scripts = scripts.filter(script => script.platform === platform);
    }

    // Filter by completion status
    if (completed !== undefined) {
      const isCompleted = completed === 'true';
      scripts = scripts.filter(script => script.completed === isCompleted);
    }

    // Filter by date range
    if (startDate || endDate) {
      scripts = scripts.filter(script => {
        // Skip scripts without valid generatedAt date
        if (!script.generatedAt) {
          return false;
        }
        
        const scriptDate = new Date(script.generatedAt);
        
        // Skip scripts with invalid dates
        if (isNaN(scriptDate.getTime())) {
          return false;
        }
        
        if (startDate && endDate) {
          const start = new Date(startDate as string);
          const end = new Date(endDate as string);
          
          // Validate input dates
          if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return true; // Skip filtering if input dates are invalid
          }
          
          // Set end date to end of day
          end.setHours(23, 59, 59, 999);
          return scriptDate >= start && scriptDate <= end;
        } else if (startDate) {
          const start = new Date(startDate as string);
          
          // Validate input date
          if (isNaN(start.getTime())) {
            return true; // Skip filtering if input date is invalid
          }
          
          return scriptDate >= start;
        } else if (endDate) {
          const end = new Date(endDate as string);
          
          // Validate input date
          if (isNaN(end.getTime())) {
            return true; // Skip filtering if input date is invalid
          }
          
          // Set end date to end of day
          end.setHours(23, 59, 59, 999);
          return scriptDate <= end;
        }
        return true;
      });
    }

    // Sort scripts by generation date (newest first)
    scripts.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());

    res.status(HttpStatusCode.Ok).send({
      message: "Scripts retrieved successfully.",
      scripts,
      total: scripts.length,
      filters: {
        type: type || null,
        platform: platform || null,
        startDate: startDate || null,
        endDate: endDate || null,
        completed: completed || null
      }
    });
    return;

  } catch (error) {
    console.error('Error retrieving scripts:', error);
    next(error);
  }
}

/**
 * Delete a specific script from a content project
 */
export async function deleteScript(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { contentId, scriptIndex } = req.params;

    // Validate content ID
    if (!Types.ObjectId.isValid(contentId)) {
      res.status(HttpStatusCode.BadRequest).send({
        message: "Invalid content ID format."
      });
      return;
    }

    // Validate script index
    const scriptIndexNum = parseInt(scriptIndex);
    if (isNaN(scriptIndexNum) || scriptIndexNum < 0) {
      res.status(HttpStatusCode.BadRequest).send({
        message: "Invalid script index format."
      });
      return;
    }

    if (!req.user) {
      res.status(HttpStatusCode.Unauthorized).send({
        message: "User authentication required."
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

    // Verify business belongs to user
    const business = await models.business.findOne({
      _id: content.business,
      owner: req.user.id
    });

    if (!business) {
      res.status(HttpStatusCode.Forbidden).send({
        message: "Access denied to this content project."
      });
      return;
    }

    // Check if script index exists
    if (scriptIndexNum >= content.scripts.length) {
      res.status(HttpStatusCode.NotFound).send({
        message: "Script not found at the specified index."
      });
      return;
    }

    // Remove script from array
    content.scripts.splice(scriptIndexNum, 1);
    await content.save();

    res.status(HttpStatusCode.Ok).send({
      message: "Script deleted successfully.",
      remainingScripts: content.scripts.length
    });
    return;

  } catch (error) {
    console.error('Error deleting script:', error);
    next(error);
  }
}

/**
 * Toggle script completion status
 */
export async function toggleScriptCompletion(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { contentId, scriptIndex } = req.params;
    const { completed } = req.body;

    // Validate content ID
    if (!Types.ObjectId.isValid(contentId)) {
      res.status(HttpStatusCode.BadRequest).send({
        message: "Invalid content ID format."
      });
      return;
    }

    // Validate script index
    const scriptIndexNum = parseInt(scriptIndex);
    if (isNaN(scriptIndexNum) || scriptIndexNum < 0) {
      res.status(HttpStatusCode.BadRequest).send({
        message: "Invalid script index format."
      });
      return;
    }

    // Validate completed field
    if (typeof completed !== 'boolean') {
      res.status(HttpStatusCode.BadRequest).send({
        message: "Completed field must be a boolean value."
      });
      return;
    }

    if (!req.user) {
      res.status(HttpStatusCode.Unauthorized).send({
        message: "User authentication required."
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

    // Verify business belongs to user
    const business = await models.business.findOne({
      _id: content.business,
      owner: req.user.id
    });

    if (!business) {
      res.status(HttpStatusCode.Forbidden).send({
        message: "Access denied to this content project."
      });
      return;
    }

    // Check if script index exists
    if (scriptIndexNum >= content.scripts.length) {
      res.status(HttpStatusCode.NotFound).send({
        message: "Script not found at the specified index."
      });
      return;
    }

    // Update script completion status
    content.scripts[scriptIndexNum].completed = completed;
    await content.save();

    res.status(HttpStatusCode.Ok).send({
      message: `Script marked as ${completed ? 'completed' : 'not completed'} successfully.`,
      script: content.scripts[scriptIndexNum]
    });
    return;

  } catch (error) {
    console.error('Error toggling script completion:', error);
    next(error);
  }
}

/**
 * Get business information by content ID
 */
export async function getBusinessByContentId(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { contentId } = req.params;

    // Validate content ID
    if (!Types.ObjectId.isValid(contentId)) {
      res.status(HttpStatusCode.BadRequest).send({
        message: "Invalid content ID format."
      });
      return;
    }

    if (!req.user) {
      res.status(HttpStatusCode.Unauthorized).send({
        message: "User authentication required."
      });
      return;
    }

    // Find content project and populate business information
    const content = await models.content.findById(contentId)
      .populate('business');

    if (!content) {
      res.status(HttpStatusCode.NotFound).send({
        message: "Content project not found."
      });
      return;
    }

    // Verify business belongs to user
    const business = await models.business.findOne({
      _id: content.business,
      owner: req.user.id
    });

    if (!business) {
      res.status(HttpStatusCode.Forbidden).send({
        message: "Access denied to this content project."
      });
      return;
    }

    res.status(HttpStatusCode.Ok).send({
      message: "Business information retrieved successfully.",
      business: content.business
    });
    return;

  } catch (error) {
    console.error('Error retrieving business by content ID:', error);
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
      owner: req.user.id
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