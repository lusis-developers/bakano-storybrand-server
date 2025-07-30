# Content Generation System - Simplified Flow

## Overview

The Content Generation System is a streamlined approach to creating marketing materials based on business information. The system follows a logical flow: **Business Questions → Soundbites & Taglines → Scripts → Content & Ads**.

## System Architecture

### Core Flow

```
Business Creation → Answer Questions → Generate Soundbites/Taglines → Create Scripts → Generate Content/Ads
```

### Data Models

#### Content Model (`IContent`)
The main model that handles the entire content generation process:

```typescript
interface IContent {
  business: ObjectId;              // Reference to business
  questions: IBusinessQuestions;   // 8 core business questions
  soundbites: ISoundbite[];       // Generated soundbites
  taglines: ITagline[];           // Generated taglines
  scripts: IScript[];             // Generated scripts
  aiProvider: 'openai' | 'gemini';
  tone: string;
  status: 'draft' | 'questions_completed' | 'content_generated' | 'completed';
}
```

#### Business Questions (`IBusinessQuestions`)
Simplified from the original BrandScript, focusing on essential information:

```typescript
interface IBusinessQuestions {
  companyName: string;
  productsServices: string;
  targetAudience: string;
  mainProblem: string;
  solution: string;
  uniqueCharacteristics: string;
  authority: string;
  steps: string;
}
```

## API Endpoints

### Content Management

#### 1. Create Content Project
```http
POST /api/content/business/:businessId
```
**Body:**
```json
{
  "questions": {
    "companyName": "Your Company",
    "productsServices": "What you offer",
    "targetAudience": "Who you serve",
    "mainProblem": "Problem you solve",
    "solution": "How you solve it",
    "uniqueCharacteristics": "What makes you unique",
    "authority": "Why trust you",
    "steps": "How customers get results"
  },
  "tone": "professional",
  "aiProvider": "gemini"
}
```

#### 2. Get Content Project
```http
GET /api/content/business/:businessId
```

#### 3. Update Questions
```http
PUT /api/content/:contentId/questions
```
**Body:**
```json
{
  "questions": {
    "companyName": "Updated Company Name"
  }
}
```

### Content Generation

#### 4. Generate Soundbites & Taglines
```http
POST /api/content/:contentId/generate-soundbites-taglines
```
**Body:**
```json
{
  "regenerate": false
}
```

**Response:**
```json
{
  "soundbites": [
    {
      "text": "Transform your business with intelligent solutions",
      "category": "primary",
      "generatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "taglines": [
    {
      "text": "Smart Solutions, Real Results",
      "style": "professional",
      "generatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### 5. Generate Scripts
```http
POST /api/content/:contentId/generate-script
```
**Body:**
```json
{
  "scriptType": "content",
  "platform": "youtube",
  "selectedSoundbite": "Transform your business with intelligent solutions",
  "selectedTagline": "Smart Solutions, Real Results"
}
```

**Response:**
```json
{
  "script": {
    "type": "content",
    "title": "How to Transform Your Business in 2024",
    "content": "[INTRO] Welcome to our channel...",
    "duration": "3-4 minutes",
    "platform": "youtube",
    "generatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

## Frontend Flow

### Recommended User Journey

1. **Business Setup**
   - User creates/selects a business
   - Navigate to content generation

2. **Answer Questions**
   - Present 8 business questions in a user-friendly form
   - Save progress automatically
   - Validate completion before proceeding

3. **Generate Foundation**
   - Generate soundbites and taglines
   - Allow user to review and regenerate if needed
   - Show different categories/styles

4. **Create Scripts**
   - Let user select preferred soundbite and tagline
   - Choose script type (content vs ad)
   - Select platform for optimization
   - Generate multiple scripts for different purposes

5. **Content Library**
   - Display all generated content
   - Allow editing and regeneration
   - Export options

### UI Components Suggestions

#### 1. Question Form
```jsx
<QuestionForm>
  <QuestionCard question="What is your company name?" />
  <QuestionCard question="What products/services do you offer?" />
  // ... 8 questions total
  <ProgressBar current={3} total={8} />
</QuestionForm>
```

#### 2. Content Generation Dashboard
```jsx
<ContentDashboard>
  <SoundbitesSection soundbites={soundbites} />
  <TaglinesSection taglines={taglines} />
  <ScriptsSection scripts={scripts} />
  <GenerateButton type="soundbites" />
  <GenerateButton type="script" />
</ContentDashboard>
```

#### 3. Script Generator
```jsx
<ScriptGenerator>
  <SoundbiteSelector options={soundbites} />
  <TaglineSelector options={taglines} />
  <ScriptTypeSelector options={['content', 'ad']} />
  <PlatformSelector options={['youtube', 'social', 'email']} />
  <GenerateButton />
</ScriptGenerator>
```

## Content Service

The `ContentService` class handles all AI generation logic:

```typescript
class ContentService {
  constructor(aiProvider: 'openai' | 'gemini');
  
  generateSoundbitesAndTaglines(
    questions: IBusinessQuestions,
    tone: string
  ): Promise<IGeneratedContent>;
  
  generateScript(
    questions: IBusinessQuestions,
    scriptType: 'content' | 'ad',
    selectedSoundbite: string,
    selectedTagline: string,
    platform?: string,
    tone?: string
  ): Promise<IScriptGeneration>;
}
```

## Benefits of This Approach

### 1. **Simplified Flow**
- Clear, logical progression
- Easy to understand for users
- Reduced complexity

### 2. **Focused Output**
- Soundbites for key messaging
- Taglines for branding
- Scripts for specific platforms
- Content and ads for marketing

### 3. **Flexible Generation**
- Multiple AI providers
- Different tones and styles
- Platform-specific optimization
- Regeneration capabilities

### 4. **Better UX**
- Step-by-step process
- Clear progress indicators
- Immediate feedback
- Easy content management

## Integration with Existing Features

### Preserved Components
- **Business Management**: Full business CRUD operations
- **User Authentication**: Complete auth system
- **Integrations**: All third-party integrations maintained
- **Color Enums**: Design system preserved

### Removed Components
- **Campaign System**: Replaced with direct content generation
- **Onboarding Context**: Simplified to business questions
- **Complex BrandScript**: Streamlined to essential questions

## Usage Example

```javascript
// 1. Create content project
const contentProject = await fetch('/api/content/business/123', {
  method: 'POST',
  body: JSON.stringify({
    questions: {
      companyName: 'TechFlow Solutions',
      productsServices: 'Business automation software',
      targetAudience: 'Small business owners',
      mainProblem: 'Manual processes waste time',
      solution: 'Automated workflows',
      uniqueCharacteristics: 'AI-powered automation',
      authority: '10+ years experience',
      steps: '1. Sign up 2. Configure 3. Automate'
    },
    tone: 'professional'
  })
});

// 2. Generate soundbites and taglines
const content = await fetch('/api/content/456/generate-soundbites-taglines', {
  method: 'POST'
});

// 3. Generate script
const script = await fetch('/api/content/456/generate-script', {
  method: 'POST',
  body: JSON.stringify({
    scriptType: 'ad',
    platform: 'youtube',
    selectedSoundbite: 'Automate your business, amplify your success',
    selectedTagline: 'Work Smarter, Not Harder'
  })
});
```

This system provides a clean, efficient way to generate marketing content while maintaining the flexibility and power needed for professional use.