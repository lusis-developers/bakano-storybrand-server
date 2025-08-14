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
	 * Handles multiple JSON objects by extracting only the first valid one
	 */
	private cleanAIResponse(response: string): string {
		// Remove markdown code blocks and common prefixes
		let cleaned = response
			.replace(/```json\s*/gi, "")
			.replace(/```\s*/g, "")
			.replace(/^Here's.*?:/gm, "") // Remove "Here's the response:" type prefixes
			.replace(/^Response:/gm, "") // Remove "Response:" prefixes
			.replace(/^JSON:/gm, "") // Remove "JSON:" prefixes
			.replace(/\n\s*\n/g, "\n") // Remove multiple newlines
			.replace(/[\u200B-\u200D\uFEFF]/g, ""); // Remove zero-width characters

		// Remove any leading/trailing whitespace
		cleaned = cleaned.trim();

		// Find the first complete JSON object
		const firstBrace = cleaned.indexOf("{");
		if (firstBrace === -1) {
			return cleaned; // No JSON object found
		}

		// Extract the first complete JSON object by counting braces
		let braceCount = 0;
		let inString = false;
		let escapeNext = false;
		let endIndex = -1;

		for (let i = firstBrace; i < cleaned.length; i++) {
			const char = cleaned[i];

			if (escapeNext) {
				escapeNext = false;
				continue;
			}

			if (char === '\\') {
				escapeNext = true;
				continue;
			}

			if (char === '"' && !escapeNext) {
				inString = !inString;
				continue;
			}

			if (!inString) {
				if (char === '{') {
					braceCount++;
				} else if (char === '}') {
					braceCount--;
					if (braceCount === 0) {
						endIndex = i;
						break;
					}
				}
			}
		}

		if (endIndex !== -1) {
			cleaned = cleaned.substring(firstBrace, endIndex + 1);
		} else {
			// Fallback: try to find the last closing brace
			const lastBrace = cleaned.lastIndexOf("}");
			if (lastBrace > firstBrace) {
				cleaned = cleaned.substring(firstBrace, lastBrace + 1);
			}
		}

		return cleaned.trim();
	}

	private repairJsonString(jsonString: string): string | null {
		try {
			// Common JSON repair strategies
			let repaired = jsonString;
			
			// Remove trailing commas before closing braces/brackets
			repaired = repaired.replace(/,\s*([}\]])/g, '$1');
			
			// Fix unescaped quotes in strings (basic attempt)
			repaired = repaired.replace(/"([^"]*?)"([^":,}\]\s])/g, '"$1\\"$2');
			
			// Ensure proper closing of the JSON object
			const openBraces = (repaired.match(/{/g) || []).length;
			const closeBraces = (repaired.match(/}/g) || []).length;
			
			if (openBraces > closeBraces) {
				repaired += '}'.repeat(openBraces - closeBraces);
			}
			
			// Try to parse the repaired JSON to validate
			JSON.parse(repaired);
			return repaired;
		} catch (error) {
			// If repair fails, return null
			return null;
		}
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
			console.error("Cleaned response length:", cleanedResponse.length);
			console.error("Cleaned response preview:", cleanedResponse.substring(0, 500) + "...");
			console.error("Raw AI response length:", response.length);
			
			// Try to repair common JSON issues
			const repairedJson = this.repairJsonString(cleanedResponse);
			if (repairedJson) {
				try {
					parsedScript = JSON.parse(repairedJson);
					console.log("Successfully repaired and parsed JSON");
				} catch (repairError: any) {
					console.error("Failed to parse repaired JSON:", repairError);
					throw new Error(
						`Invalid JSON format in AI response after repair attempt: ${parseError.message}`
					);
				}
			} else {
				throw new Error(
					`Invalid JSON format in AI response: ${parseError.message}`
				);
			}
		}

			// Validate that parsedScript is a valid object
			if (!parsedScript || typeof parsedScript !== 'object') {
				throw new Error('AI response is not a valid object');
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
			let scriptTitle = parsedScript.title || `${scriptType.charAt(0).toUpperCase() + scriptType.slice(1)} Script`;
			// Ensure title doesn't exceed 100 characters
			if (scriptTitle.length > 100) {
				scriptTitle = scriptTitle.substring(0, 97) + '...';
			}
			let scriptDuration = parsedScript.duration || this.getEstimatedDuration(scriptType, platform);

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

			// Ensure we have valid content
			if (!scriptContent || typeof scriptContent !== 'string' || scriptContent.trim().length === 0) {
				throw new Error('Generated script content is empty or invalid');
			}

			return {
				title: scriptTitle,
				content: scriptContent.trim(),
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

		const estimatedDuration = this.getEstimatedDuration(scriptType, platform);

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
Target Duration: ${estimatedDuration}

**PURPOSE:**
${scriptPurpose}

${platformGuidelines}

**SCRIPT STRUCTURE:**
${
			scriptType === "ad"
				? this.getAdScriptStructure()
				: this.getContentScriptStructure()
		}

**CONTENT REQUIREMENTS:**
- Write the script content in markdown format with clear headings and structure
- Include timing cues in the content (e.g., [0:00-0:05], [0:05-0:15])
- Hook the audience within the first 3-5 seconds
- Clearly present the problem and solution
- Include the provided soundbite and tagline naturally within the script
- End with a strong call to action
- Match the specified tone throughout
- Ensure the script fits the target duration
- Use proper markdown formatting for readability

**EXAMPLE CONTENT FORMAT:**
# Hook [0:00-0:05]
*Attention-grabbing opening line*

## Problem Introduction [0:05-0:15]
*Identify the pain point*

## Solution Presentation [0:15-0:45]
*Present your solution with benefits*

## Call to Action [0:45-0:60]
*Clear next step with urgency*

**CRITICAL OUTPUT INSTRUCTIONS:**
1. You MUST respond with ONLY a valid JSON object
2. Do NOT include any text before or after the JSON
3. Do NOT use markdown code blocks
4. Ensure all quotes inside strings are properly escaped
5. Do NOT include trailing commas
6. Keep the title under 100 characters

**REQUIRED JSON FORMAT:**
{
  "title": "Concise script title (max 100 characters)",
  "content": "Full script content with clear sections and timing cues. Use line breaks and escape quotes properly.",
  "duration": "Estimated duration (e.g., '60 seconds', '2-3 minutes')"
}

**JSON VALIDATION EXAMPLE:**
{
  "title": "Transform Your Business Today",
  "content": "# Hook [0:00-0:05] - Are you tired of struggling with problems? ## Problem [0:05-0:15] - Many businesses face challenges...",
  "duration": "60 seconds"
}
`;
	}

	/**
	 * Get estimated duration based on script type and platform
	 */
	private getEstimatedDuration(scriptType: "content" | "ad", platform?: string): string {
		if (scriptType === "ad") {
			switch (platform) {
				case "instagram":
				case "tiktok":
					return "15-30 seconds";
				case "youtube":
					return "30-60 seconds";
				default:
					return "30-60 seconds";
			}
		} else {
			// Content scripts
			switch (platform) {
				case "instagram":
				case "tiktok":
				case "social":
					return "60-90 seconds";
				case "youtube":
					return "2-5 minutes";
				case "email":
					return "1-2 minutes read time";
				default:
					return "2-3 minutes";
			}
		}
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
1. **Hook (0-5 seconds):** Attention-grabbing opening that stops the scroll
2. **Problem Agitation (5-15 seconds):** Identify and amplify the pain point
3. **Solution Introduction (15-25 seconds):** Present your solution as the answer
4. **Benefits & Proof (25-40 seconds):** Show value, authority, testimonials, or results
5. **Urgency & Scarcity (40-50 seconds):** Create FOMO or time-sensitive offer
6. **Strong Call to Action (50-60 seconds):** Clear, specific next step with urgency

**Key Elements to Include:**
- Use the provided soundbite as a powerful statement
- Integrate the tagline naturally
- Include social proof or authority markers
- Create emotional connection
- End with specific action ("Click the link", "DM us now", "Book your call today")`;
	}

	/**
	 * Get content script structure
	 */
	private getContentScriptStructure(): string {
		return `
**CONTENT SCRIPT STRUCTURE:**
1. **Hook & Introduction (0-15 seconds):** Engaging opening + topic preview
2. **Problem Identification (15-45 seconds):** Relate to audience pain points and challenges
3. **Educational Content (45-120 seconds):** Valuable insights, tips, and actionable advice
4. **Authority & Proof (120-140 seconds):** Establish credibility and show expertise
5. **Solution Presentation (140-160 seconds):** How you can help solve their problem
6. **Soft Call to Action (160-180 seconds):** Encourage engagement and next steps

**Key Elements to Include:**
- Use the provided soundbite as an expert insight or key takeaway
- Integrate the tagline as a memorable conclusion or brand statement
- Provide genuine value and actionable content
- Build trust and authority throughout
- Include storytelling elements when appropriate
- End with engagement-focused CTA ("Comment below", "Share your experience", "Follow for more tips")`;
	}
}
