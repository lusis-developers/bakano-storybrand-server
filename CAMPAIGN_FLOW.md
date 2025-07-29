# Campaign Generation Flow

This document explains the professional workflow for generating marketing campaigns based on completed BrandScripts.

## Overview

The campaign system allows users to generate multiple marketing assets based on their completed BrandScript using the StoryBrand framework. The flow ensures that users have a solid foundation (completed BrandScript) before creating targeted marketing materials.

## Workflow Steps

### 1. Complete BrandScript
Before creating any campaign, users must:
- Complete all required BrandScript sections
- Have status set to 'completed'
- Ensure all core StoryBrand elements are filled:
  - Controlling Idea
  - Character (What They Want)
  - Problem (External)
  - Guide (Empathy)
  - Plan (Process Steps)
  - Call to Action (Direct)
  - Success Results

### 2. Check Campaign Readiness
**Endpoint:** `GET /api/brandscripts/:id/campaign-readiness`

This endpoint validates:
- BrandScript completion status
- Required fields presence
- User permissions
- Existing campaigns for this BrandScript

**Response includes:**
```json
{
  "success": true,
  "data": {
    "brandScript": {
      "id": "...",
      "controllingIdea": "...",
      "status": "completed",
      "isCompleted": true,
      "hasRequiredFields": true,
      "canCreateCampaign": true
    },
    "business": {
      "id": "...",
      "name": "...",
      "industry": "..."
    },
    "existingCampaigns": [...],
    "nextSteps": "You can now create a campaign..."
  }
}
```

### 3. View Available Assets
**Endpoint:** `GET /api/campaigns/assets`

Returns all available marketing assets organized by category:

#### Key Brand Assets
- **BrandScript** (required) - Core brand messaging framework
- **Tagline** - Memorable brand line
- **One-Liner** - Elevator pitch

#### Social Media Assets
- **Website Wireframe** - Landing page layout
- **Website Review** - Site optimization analysis
- **Social Media Post Ideas & Captions** - Social content

#### Marketing Assets
- **Blog Post** - SEO-optimized content
- **Lead Generating PDF** - Downloadable resources
- **SalesScript** - Persuasive sales copy

#### Sales Assets
- **Product/Service Description** - Clear value communication
- **Brand/Product Story** - Compelling narratives
- **Sales Talking Points** - Key selling points
- **Nurture Emails** - Relationship building campaigns
- **Sales Emails** - Conversion-focused campaigns
- **Video Scripts** - Engaging video content

#### Additional Assets
- **Product/Service Name** - Memorable naming
- **Packaging Copy** - Product packaging text
- **Lead Generator Ideas** - Free resource concepts
- **Domain Name Suggestions** - Website domain options

### 4. Create Campaign
**Endpoint:** `POST /api/campaigns`

**Required fields:**
```json
{
  "businessId": "string",
  "brandScriptId": "string",
  "title": "string",
  "selectedAssets": ["array of asset types"]
}
```

**Optional fields:**
```json
{
  "description": "string",
  "campaignType": "general|product_launch|lead_generation",
  "targetAudience": "string",
  "tone": "professional|casual|friendly|authoritative",
  "aiProvider": "gemini|openai"
}
```

### 5. Generate Asset Content
**Endpoint:** `POST /api/campaigns/:campaignId/assets/:assetType/generate`

Generates content for specific assets within the campaign using AI based on the BrandScript foundation.

**Optional parameters:**
```json
{
  "customPrompt": "string",
  "additionalContext": "string"
}
```

## API Endpoints Summary

### BrandScript Endpoints
- `GET /api/brandscripts/:id/campaign-readiness` - Check readiness for campaign creation

### Campaign Endpoints
- `GET /api/campaigns/assets` - Get all available asset types
- `POST /api/campaigns` - Create new campaign
- `GET /api/campaigns` - List user's campaigns (with filtering)
- `GET /api/campaigns/:campaignId` - Get specific campaign
- `POST /api/campaigns/:campaignId/assets/:assetType/generate` - Generate asset content
- `PATCH /api/campaigns/:campaignId/status` - Update campaign status
- `DELETE /api/campaigns/:campaignId` - Delete campaign

## Campaign States

### Campaign Status
- **draft** - Initial state, assets not generated
- **in_progress** - Some assets being generated
- **completed** - All selected assets generated
- **archived** - Campaign archived by user

### Asset Status
- **pending** - Asset selected but not generated
- **generating** - AI currently generating content
- **completed** - Content successfully generated
- **error** - Generation failed

## Frontend Integration

### Recommended UI Flow

1. **After BrandScript Completion**
   - Show success message
   - Display "Create Campaign" button
   - Call campaign-readiness endpoint to validate

2. **Campaign Creation Page**
   - Load available assets from `/api/campaigns/assets`
   - Display assets organized by category
   - Allow user to select desired assets
   - Show asset descriptions to help decision-making
   - Collect campaign details (title, description, etc.)

3. **Campaign Dashboard**
   - Show campaign progress
   - Display asset generation status
   - Allow individual asset generation
   - Provide download/view options for completed assets

4. **Asset Generation**
   - Show progress indicators
   - Allow custom prompts for specific assets
   - Display generated content
   - Provide regeneration options

## Security & Validation

- All endpoints require authentication
- Business ownership validation on all operations
- BrandScript completion validation before campaign creation
- Asset type validation against available options
- Rate limiting on AI generation endpoints (recommended)

## Error Handling

### Common Error Scenarios
- BrandScript not completed
- Invalid asset types selected
- Business ownership mismatch
- AI generation failures
- Invalid campaign states

### Error Response Format
```json
{
  "success": false,
  "message": "Error description",
  "code": "ERROR_CODE" // optional
}
```

## Performance Considerations

- Use pagination for campaign lists
- Implement caching for asset definitions
- Queue system for AI generation (recommended for production)
- Progress tracking for long-running generations
- Batch operations for multiple asset generation

## Future Enhancements

- Template-based asset generation
- Asset versioning and history
- Collaborative campaign editing
- Asset performance analytics
- Integration with external marketing platforms
- Bulk asset generation
- Custom asset types