import type { IChat } from "../models/chat.model";
import { aiChatService } from "./aiChat.service";
import { facebookMarketingService } from "./facebookMarketing.service";
import models from "../models";
import { generateMktPrompt } from "../prompt/generateMktPrompt";

interface IReplyConfig {
	temperature?: number;
	maxTokens?: number;
	model?: string;
}
interface IReplyResult {
	reply: string;
	usage: IChat["usage"];
	lastMessageAt: IChat["lastMessageAt"];
}

export class ChatService {
    async generateAndSaveReply(
        chat: IChat,
        config: IReplyConfig = {}
    ): Promise<IReplyResult> {
        const { temperature = 0.7, maxTokens = 600, model } = config;

        let ads: any[] = []
        try {
            const integration = await models.integration.findOne({ business: chat.business, type: 'facebook' })
            const adAccountId = integration?.metadata?.adAccountId as string | undefined
            const userAccessToken = integration?.metadata?.userAccessToken as string | undefined
            if (adAccountId && userAccessToken) {
                ads = await facebookMarketingService.getAdsWithLinksAndMetrics(adAccountId, userAccessToken, { date_preset: 'last_7d', limit: 10 })
            }
        } catch {}
        const systemPrompt = ads.length > 0
            ? await generateMktPrompt(ads)
            : (chat.systemPrompt || "You are a friendly assistant. Keep answers short and conversational.")
        const context = chat.getContextForAI(20);
        try {
            const aiResult = await aiChatService.generateChatCompletion(
                systemPrompt,
                context,
                {
                    temperature,
                    maxTokens,
                    model: model || chat.aiModel,
                    primaryProvider: chat.aiProvider,
                }
            );
            const reply = aiResult.content?.trim() || "Hello!";
            chat.addMessage({
                role: "assistant",
                content: reply,
                ai: {
                    provider: aiResult.providerUsed,
                    model: aiResult.modelUsed,
                    promptTokens: aiResult.usage?.promptTokens,
                    completionTokens: aiResult.usage?.completionTokens,
                    totalTokens: aiResult.usage?.totalTokens,
                },
            });
            await chat.save();
            return { reply, usage: chat.usage, lastMessageAt: chat.lastMessageAt };
        } catch {
            const reply = "Hello!";
            chat.addMessage({ role: "assistant", content: reply });
            await chat.save();
            return { reply, usage: chat.usage, lastMessageAt: chat.lastMessageAt };
        }
    }
}

export const chatService = new ChatService();
