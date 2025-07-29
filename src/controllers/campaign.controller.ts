import type { Response, NextFunction } from 'express';
import { HttpStatusCode } from 'axios';
import { Types } from 'mongoose';
import models from '../models';
import type { AuthRequest } from '../types/AuthRequest';

// Definición de assets disponibles organizados por categoría
const AVAILABLE_ASSETS = {
  'Key Brand Assets': [
    {
      type: 'brandscript',
      title: 'BrandScript',
      description: 'Create a clear and compelling brand message based on the StoryBrand 7-part framework.',
      required: true
    },
    {
      type: 'tagline',
      title: 'Tagline',
      description: 'A concise, memorable line about your brand or product that invites qualified buyers to do business with you.',
      required: false
    },
    {
      type: 'one-liner',
      title: 'One-Liner',
      description: 'Short or simple, clear elevator pitch that sparks curiosity and helps you explain what you do in seconds.',
      required: false
    }
  ],
  'Social Media Assets': [
    {
      type: 'website-wireframe',
      title: 'Website Wireframe',
      description: 'Generate the layout and messaging for a high-converting landing page focused on your product, lead generation, or event brand.',
      required: false
    },
    {
      type: 'website-review',
      title: 'Website Review',
      description: 'Analyze your website effectiveness based on the StoryBrand framework and learn how to optimize your site for clarity, conversion and customer engagement.',
      required: false
    },
    {
      type: 'social-media-post',
      title: 'Social Media Post Ideas & Captions',
      description: 'Create posts and captions that captivate your audience and stop the scroll.',
      required: false
    }
  ],
  'Marketing Assets': [
    {
      type: 'blog-post',
      title: 'Blog Post',
      description: 'Create an SEO-optimized blog post designed to boost website traffic, improve your audience, build trust, and drive action.',
      required: false
    },
    {
      type: 'lead-generating-pdf',
      title: 'Lead Generating PDF',
      description: 'Create a high-value, free downloadable resource designed to attract potential leads and grow your email list.',
      required: false
    },
    {
      type: 'sales-script',
      title: 'SalesScript',
      description: 'Write persuasive sales scripts that connect with your audience, build trust and close the sale.',
      required: false
    }
  ],
  'Sales Assets': [
    {
      type: 'product-description',
      title: 'Product or Service Description',
      description: 'Clearly communicate descriptions that showcase your product value and helps customers understand why they need it.',
      required: false
    },
    {
      type: 'brand-story',
      title: 'Brand or Product Story',
      description: 'Craft a clear, compelling story about your brand, product, or the before section of your website using the StoryBrand framework.',
      required: false
    },
    {
      type: 'sales-talking-points',
      title: 'Sales Talking Points',
      description: 'Develop clear sales talking points, impactful talking points to confidently sell your product or service.',
      required: false
    },
    {
      type: 'nurture-emails',
      title: 'Nurture Emails',
      description: 'Design follow-up email campaigns that keep you top-of-mind and build relationships with your audience.',
      required: false
    },
    {
      type: 'sales-emails',
      title: 'Sales Emails',
      description: 'Create sales email campaigns that keep your brand top-of-mind and drive customers towards a buying decision.',
      required: false
    },
    {
      type: 'video-scripts',
      title: 'Video Scripts',
      description: 'Generate attention-grabbing scripts that ensure your message drives action when the camera starts rolling.',
      required: false
    }
  ],
  'Select All Assets': [
    {
      type: 'product-name',
      title: 'Product or Service Name',
      description: 'Brainstorm powerful, memorable names that you can offer potential clients to build trust with your authority.',
      required: false
    },
    {
      type: 'packaging-copy',
      title: 'Packaging Copy',
      description: 'Write clear, persuasive packaging copy that grabs attention and communicates why your product is the perfect choice.',
      required: false
    },
    {
      type: 'lead-generator-ideas',
      title: 'Lead Generator Ideas',
      description: 'Brainstorm free, value-packed resources you can offer potential clients to build trust with your authority.',
      required: false
    },
    {
      type: 'domain-suggestions',
      title: 'Domain Name Suggestions',
      description: 'Find the perfect domain name for your business, product, or lead generator.',
      required: false
    }
  ]
};

/**
 * Get all available assets organized by category
 */
export async function getAvailableAssets(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const totalAssets = Object.values(AVAILABLE_ASSETS).flat().length;
    
    res.status(HttpStatusCode.Ok).send({
      success: true,
      message: 'Available assets retrieved successfully.',
      data: {
        assetsByCategory: AVAILABLE_ASSETS,
        totalAssets
      }
    });
    return;

  } catch (error) {
    console.error('Error getting available assets:', error);
    next(error);
  }
}

/**
 * Create a new campaign after completing BrandScript
 */
export async function createCampaign(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const {
      businessId,
      brandScriptId,
      title,
      description,
      campaignType = 'general',
      targetAudience,
      selectedAssets,
      tone = 'professional',
      aiProvider = 'gemini'
    } = req.body;
    
    const userId = req.user?.id;

    if (!userId) {
      res.status(HttpStatusCode.Unauthorized).send({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    // Validate required fields
    if (!businessId || !brandScriptId || !title || !selectedAssets || !Array.isArray(selectedAssets)) {
      res.status(HttpStatusCode.BadRequest).send({
        success: false,
        message: 'Missing required fields: businessId, brandScriptId, title, and selectedAssets are required'
      });
      return;
    }

    // Verify business belongs to user
    const business = await models.business.findOne({ _id: businessId, owner: userId });
    if (!business) {
      res.status(HttpStatusCode.NotFound).send({
        success: false,
        message: 'Business not found or you do not have permission to access it'
      });
      return;
    }

    // Verify BrandScript exists and belongs to the business
    const brandScript = await models.brandscript.findOne({ _id: brandScriptId, business: businessId });
    if (!brandScript) {
      res.status(HttpStatusCode.NotFound).send({
        success: false,
        message: 'BrandScript not found or does not belong to this business'
      });
      return;
    }

    // Verify BrandScript is completed
    if (brandScript.status !== 'completed') {
      res.status(HttpStatusCode.BadRequest).send({
        success: false,
        message: 'BrandScript must be completed before creating a campaign'
      });
      return;
    }

    // Validate selected assets
    const allAvailableAssets = Object.values(AVAILABLE_ASSETS).flat();
    const validAssetTypes = allAvailableAssets.map(asset => asset.type);
    const invalidAssets = selectedAssets.filter((asset: string) => !validAssetTypes.includes(asset));
    
    if (invalidAssets.length > 0) {
      res.status(HttpStatusCode.BadRequest).send({
        success: false,
        message: `Invalid asset types: ${invalidAssets.join(', ')}`
      });
      return;
    }

    // Create initial assets array with pending status
    const generatedAssets = selectedAssets.map((assetType: string) => {
      const assetInfo = allAvailableAssets.find(asset => asset.type === assetType);
      return {
        type: assetType,
        title: assetInfo?.title || assetType,
        status: 'pending'
      };
    });

    // Create campaign
    const campaign = new models.campaign({
      business: businessId,
      brandScript: brandScriptId,
      title,
      description,
      campaignType,
      targetAudience,
      selectedAssets,
      generatedAssets,
      tone,
      aiProvider,
      status: 'draft'
    });

    await campaign.save();
    await campaign.populate([
      { path: 'business', select: 'name industry' },
      { path: 'brandScript', select: 'controllingIdea status' }
    ]);

    res.status(HttpStatusCode.Created).send({
      success: true,
      message: 'Campaign created successfully.',
      data: {
        campaign: campaign.toObject()
      }
    });
    return;

  } catch (error) {
    console.error('Error creating campaign:', error);
    next(error);
  }
}

/**
 * Get campaigns for a user with optional filtering
 */
export async function getCampaigns(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { businessId, status, page = 1, limit = 10 } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      res.status(HttpStatusCode.Unauthorized).send({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    // Build filters
    const filters: any = {};
    
    if (businessId) {
      // Verify business belongs to user
      const business = await models.business.findOne({ _id: businessId, owner: userId });
      if (!business) {
        res.status(HttpStatusCode.NotFound).send({
          success: false,
          message: 'Business not found'
        });
        return;
      }
      filters.business = businessId;
    } else {
      // Get all businesses owned by user
      const userBusinesses = await models.business.find({ owner: userId }).select('_id');
      filters.business = { $in: userBusinesses.map(b => b._id) };
    }

    if (status) {
      filters.status = status;
    }

    // Pagination
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Get campaigns with pagination
    const [campaigns, total] = await Promise.all([
      models.campaign.find(filters)
        .populate('business', 'name industry')
        .populate('brandScript', 'controllingIdea status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      models.campaign.countDocuments(filters)
    ]);

    res.status(HttpStatusCode.Ok).send({
      success: true,
      message: 'Campaigns retrieved successfully.',
      data: {
        campaigns,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }
    });
    return;

  } catch (error) {
    console.error('Error getting campaigns:', error);
    next(error);
  }
}

/**
 * Get a specific campaign by ID
 */
export async function getCampaignById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { campaignId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(HttpStatusCode.Unauthorized).send({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    if (!Types.ObjectId.isValid(campaignId)) {
      res.status(HttpStatusCode.BadRequest).send({
        success: false,
        message: 'Invalid campaign ID'
      });
      return;
    }

    const campaign = await models.campaign.findById(campaignId)
      .populate({
        path: 'business',
        select: 'name industry owner',
        match: { owner: userId }
      })
      .populate('brandScript', 'controllingIdea characterWhatTheyWant problemExternal guideEmpathy planProcessSteps callToActionDirect successResults');

    if (!campaign || !campaign.business) {
      res.status(HttpStatusCode.NotFound).send({
        success: false,
        message: 'Campaign not found or you do not have permission to access it'
      });
      return;
    }

    res.status(HttpStatusCode.Ok).send({
      success: true,
      message: 'Campaign retrieved successfully.',
      data: {
        campaign: campaign.toObject()
      }
    });
    return;

  } catch (error) {
    console.error('Error getting campaign:', error);
    next(error);
  }
}

/**
 * Generate content for a specific asset in the campaign
 */
export async function generateAssetContent(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { campaignId, assetType } = req.params;
    const { customPrompt, additionalContext } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(HttpStatusCode.Unauthorized).send({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    if (!Types.ObjectId.isValid(campaignId)) {
      res.status(HttpStatusCode.BadRequest).send({
        success: false,
        message: 'Invalid campaign ID'
      });
      return;
    }

    // Get campaign with business ownership validation
    const campaign = await models.campaign.findById(campaignId)
      .populate({
        path: 'business',
        select: 'name owner',
        match: { owner: userId }
      })
      .populate('brandScript');

    if (!campaign || !campaign.business) {
      res.status(HttpStatusCode.NotFound).send({
        success: false,
        message: 'Campaign not found or you do not have permission to access it'
      });
      return;
    }

    // Verify asset type is selected in campaign
    if (!campaign.selectedAssets.includes(assetType)) {
      res.status(HttpStatusCode.BadRequest).send({
        success: false,
        message: 'Asset type not selected for this campaign'
      });
      return;
    }

    // Update asset status to generating
    const updateResult = campaign.updateAssetStatus(assetType, 'generating');
    if (!updateResult) {
      res.status(HttpStatusCode.BadRequest).send({
        success: false,
        message: 'Asset not found in campaign'
      });
      return;
    }
    await campaign.save();

    // Get brandScript data for content generation
    const brandScript = await models.brandscript.findById(campaign.brandScript).populate('business');
    const populatedBusiness = brandScript?.business as any;
    const businessName = populatedBusiness?.name || 'Your Business';
    const controllingIdea = brandScript?.controllingIdea || 'Transform your business';

    // TODO: Implement AI content generation here
    // For now, we'll simulate content generation
    const simulatedContent = `Generated content for ${assetType} based on BrandScript: ${controllingIdea} for ${businessName}`;
    
    // Update asset with generated content
    campaign.updateAssetStatus(assetType, 'completed', simulatedContent);
    await campaign.save();

    res.status(HttpStatusCode.Ok).send({
      success: true,
      message: 'Asset content generated successfully.',
      data: {
        assetType,
        content: simulatedContent,
        campaign: {
          id: campaign._id,
          progress: campaign.progress
        }
      }
    });
    return;

  } catch (error) {
    console.error('Error generating asset content:', error);
    
    // Update asset status to error if campaign exists
    try {
      const { campaignId, assetType } = req.params;
      const campaign = await models.campaign.findById(campaignId);
      if (campaign) {
        campaign.updateAssetStatus(assetType, 'error', undefined, 'Failed to generate content');
        await campaign.save();
      }
    } catch (updateError) {
      console.error('Error updating asset status to error:', updateError);
    }
    
    next(error);
  }
}

/**
 * Update campaign status
 */
export async function updateCampaignStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { campaignId } = req.params;
    const { status } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(HttpStatusCode.Unauthorized).send({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    if (!Types.ObjectId.isValid(campaignId)) {
      res.status(HttpStatusCode.BadRequest).send({
        success: false,
        message: 'Invalid campaign ID'
      });
      return;
    }

    const validStatuses = ['draft', 'in_progress', 'completed', 'archived'];
    if (!validStatuses.includes(status)) {
      res.status(HttpStatusCode.BadRequest).send({
        success: false,
        message: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
      });
      return;
    }

    const campaign = await models.campaign.findById(campaignId)
      .populate({
        path: 'business',
        select: 'owner',
        match: { owner: userId }
      });

    if (!campaign || !campaign.business) {
      res.status(HttpStatusCode.NotFound).send({
        success: false,
        message: 'Campaign not found or you do not have permission to access it'
      });
      return;
    }

    campaign.status = status;
    await campaign.save();

    res.status(HttpStatusCode.Ok).send({
      success: true,
      message: 'Campaign status updated successfully.',
      data: {
        campaign: {
          id: campaign._id,
          status: campaign.status,
          progress: campaign.progress
        }
      }
    });
    return;

  } catch (error) {
    console.error('Error updating campaign status:', error);
    next(error);
  }
}

/**
 * Delete a campaign
 */
export async function deleteCampaign(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { campaignId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(HttpStatusCode.Unauthorized).send({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    if (!Types.ObjectId.isValid(campaignId)) {
      res.status(HttpStatusCode.BadRequest).send({
        success: false,
        message: 'Invalid campaign ID'
      });
      return;
    }

    const campaign = await models.campaign.findById(campaignId)
      .populate({
        path: 'business',
        select: 'owner',
        match: { owner: userId }
      });

    if (!campaign || !campaign.business) {
      res.status(HttpStatusCode.NotFound).send({
        success: false,
        message: 'Campaign not found or you do not have permission to access it'
      });
      return;
    }

    await models.campaign.findByIdAndDelete(campaignId);

    res.status(HttpStatusCode.Ok).send({
      success: true,
      message: 'Campaign deleted successfully.'
    });
    return;

  } catch (error) {
    console.error('Error deleting campaign:', error);
    next(error);
  }
}