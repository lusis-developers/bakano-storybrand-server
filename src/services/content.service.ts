import { GeminiService } from "./gemini.service";
import { OpenAIService } from "./openai.service";
import type { IBusinessQuestions } from "../models/content.model";

export interface ISoundbiteGeneration {
	text: string;
	category: "primary" | "secondary" | "supporting";
}

export interface ITaglineGeneration {
	text: string;
	style: "catchy" | "professional" | "emotional" | "action-oriented";
}

export interface IScriptGeneration {
	title: string;
	content: string;
	duration: string;
}

export interface IGeneratedContent {
	soundbites: ISoundbiteGeneration[];
	taglines: ITaglineGeneration[];
}

export class ContentService {
	private aiService: GeminiService | OpenAIService;

	constructor(aiProvider: "openai" | "gemini" = "gemini") {
		if (aiProvider === "openai") {
			this.aiService = new OpenAIService();
		} else {
			this.aiService = new GeminiService();
		}
	}

	/**
	 * Clean AI response by removing markdown code blocks and extra formatting
	 */
	private cleanAIResponse(response: string): string {
		// Remove markdown code blocks
		let cleaned = response
			.replace(/```json\s*/gi, "")
			.replace(/```\s*/g, "");

		// Remove any leading/trailing whitespace
		cleaned = cleaned.trim();

		// Handle both JSON objects and arrays
		const firstBrace = cleaned.indexOf("{");
		const firstBracket = cleaned.indexOf("[");
		const lastBrace = cleaned.lastIndexOf("}");
		const lastBracket = cleaned.lastIndexOf("]");

		// Determine if it's an array or object and extract accordingly
		if (
			firstBracket !== -1 &&
			(firstBrace === -1 || firstBracket < firstBrace)
		) {
			// It's an array
			if (lastBracket !== -1 && lastBracket > firstBracket) {
				cleaned = cleaned.substring(firstBracket, lastBracket + 1);
			}
		} else if (
			firstBrace !== -1 &&
			lastBrace !== -1 &&
			lastBrace > firstBrace
		) {
			// It's an object
			cleaned = cleaned.substring(firstBrace, lastBrace + 1);
		}

		return cleaned;
	}

	/**
	 * Generate soundbites and taglines based on business questions
	 */
	async generateSoundbitesAndTaglines(
		questions: IBusinessQuestions,
		tone: string = "professional"
	): Promise<IGeneratedContent> {
		const prompt = this.buildSoundbitesTaglinesPrompt(questions, tone);
		let response: string = "";

		try {
			response = await this.aiService.generateMarketingContent(
				prompt,
				"social"
			);
			const cleanedResponse = this.cleanAIResponse(response);
			const parsedContent = JSON.parse(cleanedResponse);

			return {
				soundbites: parsedContent.soundbites || [],
				taglines: parsedContent.taglines || [],
			};
		} catch (error) {
			console.error("Error generating soundbites and taglines:", error);
			console.error("Raw AI response:", response);
			throw new Error("Failed to generate soundbites and taglines");
		}
	}

	/**
	 * Generate script for content or ads
	 */
	async generateScript(
		questions: IBusinessQuestions,
		scriptType: "content" | "ad",
		selectedSoundbite: string,
		selectedTagline: string,
		platform?: string,
		tone: string = "professional"
	): Promise<IScriptGeneration> {
		const prompt = this.buildScriptPrompt(
			questions,
			scriptType,
			selectedSoundbite,
			selectedTagline,
			platform,
			tone
		);
		let response: string = "";

		try {
			response = await this.aiService.generateMarketingContent(
				prompt,
				"social"
			);
			const cleanedResponse = this.cleanAIResponse(response);

			// Add validation before parsing
			if (!cleanedResponse || cleanedResponse.trim() === "") {
				throw new Error("Empty response from AI service");
			}

			let parsedScript;
			try {
				parsedScript = JSON.parse(cleanedResponse);
			} catch (parseError: any) {
				console.error("JSON Parse Error:", parseError);
				console.error("Cleaned response:", cleanedResponse);
				console.error("Raw AI response:", response);
				throw new Error(
					`Invalid JSON format in AI response: ${parseError.message}`
				);
			}

			// Handle array response (multiple scripts) - take the first one
			if (Array.isArray(parsedScript)) {
				if (parsedScript.length === 0) {
					throw new Error("AI returned empty array of scripts");
				}
				parsedScript = parsedScript[0];
			}

			// Handle different response formats from AI
			let scriptContent = "";
			let scriptTitle = parsedScript.title || `${scriptType} Script`;
			let scriptDuration = parsedScript.duration || "N/A";

			if (parsedScript.content) {
				// Standard format with content field
				scriptContent =
					typeof parsedScript.content === "string"
						? parsedScript.content
						: JSON.stringify(parsedScript.content);
			} else if (
				parsedScript.visual &&
				parsedScript.caption &&
				parsedScript.text
			) {
				// Alternative format with visual, caption, text
				scriptContent = `**Visual:** ${parsedScript.visual}\n\n**Caption:** ${parsedScript.caption}\n\n**Text:** ${parsedScript.text}`;
				scriptTitle = `${scriptType} Script - Social Media Format`;
			} else if (parsedScript.script) {
				// Another possible format with script field
				scriptContent =
					typeof parsedScript.script === "string"
						? parsedScript.script
						: JSON.stringify(parsedScript.script);
			} else {
				// Fallback: convert entire object to string
				scriptContent = JSON.stringify(parsedScript, null, 2);
			}

			return {
				title: scriptTitle,
				content: scriptContent,
				duration: scriptDuration,
			};
		} catch (error: any) {
			console.error("Error generating script:", error);
			if (response) {
				console.error("Raw AI response:", response);
			}

			// Re-throw with more specific error message
			if (error.message && error.message.includes("JSON")) {
				throw error;
			}
			throw new Error(
				`Failed to generate script: ${error.message || "Unknown error"}`
			);
		}
	}

	/**
	 * Build prompt for soundbites and taglines generation
	 */
	private buildSoundbitesTaglinesPrompt(
		questions: IBusinessQuestions,
		tone: string
	): string {
		return `
You are an expert marketing copywriter. Based on the following business information, generate compelling soundbites and taglines.

**BUSINESS INFORMATION:**
Company: ${questions.companyName}
Products/Services: ${questions.productsServices}
Target Audience: ${questions.targetAudience}
Main Problem: ${questions.mainProblem}
Solution: ${questions.solution}
Unique Characteristics: ${questions.uniqueCharacteristics}
Authority: ${questions.authority}
Steps: ${questions.steps}

**TONE:** ${tone}

**INSTRUCTIONS:**
Generate 3 soundbites and 3 taglines that:
- Capture the essence of the business
- Resonate with the target audience
- Address the main problem and solution
- Are memorable and impactful
- Match the specified tone

**SOUNDBITES GUIDELINES:**
- Primary: Core value proposition (15-25 words)
- Secondary: Supporting benefit (10-20 words)
- Supporting: Additional value point (8-15 words)

**TAGLINES GUIDELINES:**
- Catchy: Memorable and fun (3-8 words)
- Professional: Business-focused (4-10 words)
- Emotional: Feeling-driven (3-8 words)
- Action-oriented: Call to action (3-8 words)

**OUTPUT FORMAT (JSON only):**
{
  "soundbites": [
    {"text": "soundbite text here", "category": "primary"},
    {"text": "soundbite text here", "category": "secondary"},
    {"text": "soundbite text here", "category": "supporting"}
  ],
  "taglines": [
    {"text": "tagline text here", "style": "catchy"},
    {"text": "tagline text here", "style": "professional"},
    {"text": "tagline text here", "style": "emotional"}
  ]
}
`;
	}

	/**
	 * Build prompt for script generation
	 */
	private buildScriptPrompt(
		questions: IBusinessQuestions,
		scriptType: "content" | "ad",
		selectedSoundbite: string,
		selectedTagline: string,
		platform?: string,
		tone: string = "professional"
	): string {
		const scriptPurpose =
			scriptType === "ad"
				? "Create a compelling advertisement script that drives immediate action and conversions"
				: "Create an engaging content script that educates, builds trust, and establishes authority";

		const platformGuidelines = platform
			? this.getPlatformGuidelines(platform)
			: "";

		return `
You are an expert script writer specializing in ${scriptType} scripts. Create a compelling script based on the following information.

**BUSINESS INFORMATION:**
Company: ${questions.companyName}
Products/Services: ${questions.productsServices}
Target Audience: ${questions.targetAudience}
Main Problem: ${questions.mainProblem}
Solution: ${questions.solution}
Unique Characteristics: ${questions.uniqueCharacteristics}
Authority: ${questions.authority}
Steps: ${questions.steps}

**KEY MESSAGING:**
Soundbite: "${selectedSoundbite}"
Tagline: "${selectedTagline}"

**SCRIPT DETAILS:**
Type: ${scriptType}
Platform: ${platform || "general"}
Tone: ${tone}

**PURPOSE:**
${scriptPurpose}

${platformGuidelines}

**SCRIPT STRUCTURE:**
${
	scriptType === "ad"
		? this.getAdScriptStructure()
		: this.getContentScriptStructure()
}

**REQUIREMENTS:**
- Hook the audience within the first 3-5 seconds
- Clearly present the problem and solution
- Include the provided soundbite and tagline naturally
- End with a strong call to action
- Match the specified tone throughout
- Be engaging and conversational

**OUTPUT FORMAT (JSON only):**
{
  "title": "Compelling script title here",
  "content": "Full script content with clear sections and timing cues",
  "duration": "Estimated duration (e.g., '60 seconds', '2-3 minutes')"
}
`;
	}

	/**
	 * Get platform-specific guidelines
	 */
	private getPlatformGuidelines(platform: string): string {
		const guidelines: { [key: string]: string } = {
			social: `
**SOCIAL MEDIA GUIDELINES:**
- Keep it short and punchy (30-60 seconds)
- Start with a strong visual hook
- Use captions for accessibility
- Include trending hashtags naturally
- Optimize for mobile viewing`,

			youtube: `
**YOUTUBE GUIDELINES:**
- Longer format allowed (2-10 minutes)
- Strong intro to prevent drop-off
- Include timestamps for key sections
- Encourage likes, comments, and subscriptions
- SEO-optimized title and description`,

			podcast: `
**PODCAST GUIDELINES:**
- Conversational and natural tone
- Include verbal transitions
- Allow for natural pauses
- Storytelling approach
- Audio-only format (no visual cues)`,

			website: `
**WEBSITE GUIDELINES:**
- Clear value proposition upfront
- Scannable format with headers
- Include trust signals
- Mobile-responsive considerations
- SEO-friendly content`,

			email: `
**EMAIL GUIDELINES:**
- Compelling subject line
- Personal and direct tone
- Clear call-to-action buttons
- Mobile-optimized format
- Avoid spam trigger words`,
		};

		return guidelines[platform] || "";
	}

	/**
	 * Get ad script structure
	 */
	private getAdScriptStructure(): string {
		return `
**AD SCRIPT STRUCTURE:**
1. **Hook (0-5 seconds):** Attention-grabbing opening
2. **Problem (5-15 seconds):** Identify the pain point
3. **Solution (15-35 seconds):** Present your solution with benefits
4. **Proof (35-45 seconds):** Authority, testimonials, or results
5. **Call to Action (45-60 seconds):** Clear next step with urgency`;
	}

	/**
	 * Get content script structure
	 */
	private getContentScriptStructure(): string {
		return `
**CONTENT SCRIPT STRUCTURE:**
1. **Introduction (0-15 seconds):** Welcome and topic overview
2. **Problem Identification (15-45 seconds):** Relate to audience pain points
3. **Educational Content (45-120 seconds):** Valuable insights and tips
4. **Solution Presentation (120-150 seconds):** How you can help
5. **Call to Action (150-180 seconds):** Soft CTA for engagement`;
	}
}
