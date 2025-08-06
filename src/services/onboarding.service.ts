  import type { IUserProfile, IBusinessContext } from '../models/onboarding.model';
  import models from '../models';
  import { Types } from 'mongoose';


  export interface IOnboardingAnalytics {
    totalOnboardings: number;
    completedOnboardings: number;
    averageCompletionTime: number;
    completionRate: number;
    commonPainPoints: string[];
    popularGoals: string[];
    industryDistribution: { industry: string; count: number }[];
    departmentDistribution: { department: string; count: number }[];
  }


  export interface IPersonalizedRecommendations {
    contentTypes: string[];
    marketingChannels: string[];
    aiProviderSuggestion: 'openai' | 'gemini';
    communicationFrequency: 'daily' | 'weekly' | 'monthly';
    brandVoiceRecommendation: string;
    priorityFeatures: string[];
  }


  export interface IOnboardingInsights {
    userPersona: string;
    businessMaturityLevel: string;
    marketingReadiness: 'low' | 'medium' | 'high';
    recommendedStartingPoint: string;
    estimatedTimeToValue: number;
    riskFactors: string[];
    successFactors: string[];
  }

  export class OnboardingService {
    /**
     * Generate personalized recommendations based on user profile and business context
     */
    static generatePersonalizedRecommendations(
      userProfile: IUserProfile,
      businessContext: IBusinessContext
    ): IPersonalizedRecommendations {
      const recommendations: IPersonalizedRecommendations = {
        contentTypes: [],
        marketingChannels: [],
        aiProviderSuggestion: 'no_preference' as any,
        communicationFrequency: 'weekly',
        brandVoiceRecommendation: businessContext.brandVoice,
        priorityFeatures: []
      };

    
      if (businessContext.businessStage === 'startup' || businessContext.businessStage === 'growth') {
        recommendations.contentTypes.push('social_media', 'blog_posts', 'email_campaigns');
      }

      if (businessContext.businessStage === 'established' || businessContext.businessStage === 'enterprise') {
        recommendations.contentTypes.push('website_copy', 'ad_copy', 'video_scripts');
      }

      if (userProfile.primaryGoals.includes('brand_awareness')) {
        recommendations.contentTypes.push('social_media', 'blog_posts');
        recommendations.marketingChannels.push('social_media', 'content_marketing');
      }

      if (userProfile.primaryGoals.includes('lead_generation')) {
        recommendations.contentTypes.push('email_campaigns', 'ad_copy');
        recommendations.marketingChannels.push('email', 'paid_ads');
      }

      if (userProfile.primaryGoals.includes('sales_conversion')) {
        recommendations.contentTypes.push('website_copy', 'email_campaigns');
        recommendations.marketingChannels.push('email', 'partnerships');
      }

    
      if (userProfile.marketingExperience === 'advanced' || userProfile.experienceLevel === 'expert') {
        recommendations.aiProviderSuggestion = 'openai';
      } else {
        recommendations.aiProviderSuggestion = 'gemini';
      }

    
      if (businessContext.businessStage === 'startup') {
        recommendations.communicationFrequency = 'weekly';
      } else if (businessContext.contentCreationFrequency === 'daily') {
        recommendations.communicationFrequency = 'daily';
      } else {
        recommendations.communicationFrequency = 'monthly';
      }

    
      if (userProfile.painPoints.includes('lack_of_time')) {
        recommendations.priorityFeatures.push('automated_content_generation', 'batch_processing');
      }

      if (userProfile.painPoints.includes('unclear_messaging')) {
        recommendations.priorityFeatures.push('brand_script_wizard', 'messaging_templates');
      }

      if (userProfile.painPoints.includes('low_conversion_rates')) {
        recommendations.priorityFeatures.push('conversion_optimization', 'a_b_testing');
      }

    
      recommendations.contentTypes = [...new Set(recommendations.contentTypes)];
      recommendations.marketingChannels = [...new Set(recommendations.marketingChannels)];
      recommendations.priorityFeatures = [...new Set(recommendations.priorityFeatures)];

      return recommendations;
    }

    /**
     * Generate insights about the user and business for better onboarding
     */
    static generateOnboardingInsights(
      userProfile: IUserProfile,
      businessContext: IBusinessContext
    ): IOnboardingInsights {
      const insights: IOnboardingInsights = {
        userPersona: '',
        businessMaturityLevel: '',
        marketingReadiness: 'medium',
        recommendedStartingPoint: '',
        estimatedTimeToValue: 7,
        riskFactors: [],
        successFactors: []
      };

    
      if (userProfile.department === 'marketing' && userProfile.experienceLevel === 'expert') {
        insights.userPersona = 'Marketing Expert';
      } else if (userProfile.department === 'executive') {
        insights.userPersona = 'Business Leader';
      } else if (userProfile.marketingExperience === 'none') {
        insights.userPersona = 'Marketing Newcomer';
      } else {
        insights.userPersona = 'Marketing Professional';
      }

    
      insights.businessMaturityLevel = businessContext.businessStage;

    
      const marketingFactors = [
        businessContext.currentMarketingChannels.length > 0,
        businessContext.brandMaturity !== 'new_brand',
        userProfile.marketingExperience !== 'none',
        businessContext.marketingBudget !== 'under_1k'
      ];

      const readinessScore = marketingFactors.filter(Boolean).length;
      if (readinessScore >= 3) {
        insights.marketingReadiness = 'high';
      } else if (readinessScore >= 2) {
        insights.marketingReadiness = 'medium';
      } else {
        insights.marketingReadiness = 'low';
      }

    
      if (businessContext.brandMaturity === 'new_brand') {
        insights.recommendedStartingPoint = 'Brand Script Creation';
      } else if (userProfile.painPoints.includes('unclear_messaging')) {
        insights.recommendedStartingPoint = 'Messaging Clarification';
      } else {
        insights.recommendedStartingPoint = 'Content Generation';
      }

    
      if (insights.marketingReadiness === 'high') {
        insights.estimatedTimeToValue = 3;
      } else if (insights.marketingReadiness === 'medium') {
        insights.estimatedTimeToValue = 7;
      } else {
        insights.estimatedTimeToValue = 14;
      }

    
      if (userProfile.marketingExperience === 'none') {
        insights.riskFactors.push('Limited marketing knowledge');
      }

      if (businessContext.marketingBudget === 'under_1k') {
        insights.riskFactors.push('Limited marketing budget');
      }

      if (userProfile.painPoints.includes('lack_of_time')) {
        insights.riskFactors.push('Time constraints');
      }

      if (businessContext.currentMarketingChannels.length === 0) {
        insights.riskFactors.push('No existing marketing channels');
      }

    
      if (userProfile.experienceLevel === 'expert' || userProfile.experienceLevel === 'advanced') {
        insights.successFactors.push('High professional experience');
      }

      if (businessContext.businessStage === 'growth' || businessContext.businessStage === 'established') {
        insights.successFactors.push('Mature business foundation');
      }

      if (userProfile.primaryGoals.length > 2) {
        insights.successFactors.push('Clear business objectives');
      }

      if (businessContext.competitiveAdvantage.length > 50) {
        insights.successFactors.push('Well-defined value proposition');
      }

      return insights;
    }

    /**
     * Get onboarding analytics for admin dashboard
     */
    static async getOnboardingAnalytics(): Promise<IOnboardingAnalytics> {
      try {
        const [totalCount, completedCount, allUsers] = await Promise.all([
          models.user.countDocuments({ 'onboarding.startedAt': { $exists: true } }),
          models.user.countDocuments({ 'onboarding.completedAt': { $exists: true } }),
          models.user.find({ 'onboarding.startedAt': { $exists: true } })
            .select('onboarding.userProfile onboarding.businessContext onboarding.startedAt onboarding.completedAt')
        ]);

      
        const completedOnboardings = allUsers.filter((user: any) => user.onboarding?.completedAt);
        const totalCompletionTime = completedOnboardings.reduce((sum: number, user: any) => {
          const startTime = new Date(user.onboarding.startedAt).getTime();
          const endTime = new Date(user.onboarding.completedAt!).getTime();
          return sum + (endTime - startTime);
        }, 0);

        const averageCompletionTime = completedOnboardings.length > 0 
          ? Math.round(totalCompletionTime / completedOnboardings.length / (1000 * 60 * 60 * 24))
          : 0;

      
        const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

      
        const painPointsCount: { [key: string]: number } = {};
        allUsers.forEach((user: any) => {
          if (user.onboarding?.userProfile?.painPoints) {
            user.onboarding.userProfile.painPoints.forEach((painPoint: string) => {
              painPointsCount[painPoint] = (painPointsCount[painPoint] || 0) + 1;
            });
          }
        });

        const commonPainPoints = Object.entries(painPointsCount)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([painPoint]) => painPoint);

      
        const goalsCount: { [key: string]: number } = {};
        allUsers.forEach((user: any) => {
          if (user.onboarding?.userProfile?.primaryGoals) {
            user.onboarding.userProfile.primaryGoals.forEach((goal: string) => {
              goalsCount[goal] = (goalsCount[goal] || 0) + 1;
            });
          }
        });

        const popularGoals = Object.entries(goalsCount)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([goal]) => goal);

      
        const industryCount: { [key: string]: number } = {};
        allUsers.forEach((user: any) => {
          if (user.onboarding?.businessContext?.primaryIndustry) {
            const industry = user.onboarding.businessContext.primaryIndustry;
            industryCount[industry] = (industryCount[industry] || 0) + 1;
          }
        });

        const industryDistribution = Object.entries(industryCount)
          .map(([industry, count]) => ({ industry, count }))
          .sort((a, b) => b.count - a.count);

      
        const departmentCount: { [key: string]: number } = {};
        allUsers.forEach((user: any) => {
          if (user.onboarding?.userProfile?.department) {
            const department = user.onboarding.userProfile.department;
            departmentCount[department] = (departmentCount[department] || 0) + 1;
          }
        });

        const departmentDistribution = Object.entries(departmentCount)
          .map(([department, count]) => ({ department, count }))
          .sort((a, b) => b.count - a.count);

        return {
          totalOnboardings: totalCount,
          completedOnboardings: completedCount,
          averageCompletionTime,
          completionRate,
          commonPainPoints,
          popularGoals,
          industryDistribution,
          departmentDistribution
        };

      } catch (error) {
        console.error('Error getting onboarding analytics:', error);
        throw new Error('Failed to retrieve onboarding analytics');
      }
    }

    /**
     * Check if user should see onboarding prompts
     */
    static async shouldShowOnboarding(userId: string): Promise<boolean> {
      try {
        if (!Types.ObjectId.isValid(userId)) {
          return false;
        }

        const onboarding = await models.onboarding.findOne({ user: userId }).select('completedAt');
        
        return !onboarding?.completedAt;
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        return true;
      }
    }

    /**
     * Get next recommended action for user
     */
    static async getNextRecommendedAction(userId: string): Promise<string | null> {
      try {
        if (!Types.ObjectId.isValid(userId)) {
          return null;
        }

        const onboarding = await models.onboarding.findOne({ user: userId });

        if (!onboarding?.startedAt) {
          return 'Complete your onboarding to get personalized recommendations';
        }

        if (!onboarding.completedAt) {
          const nextStep = onboarding.getNextStep();
          switch (nextStep) {
            case 'user_profile':
              return 'Complete your professional profile';
            case 'business_context':
              return 'Provide your business context';
            case 'preferences':
              return 'Set your preferences';
            case 'first_content':
              return 'Generate your first content';
            default:
              return 'Complete your onboarding';
          }
        }

      
        if (onboarding.userProfile && onboarding.businessContext) {
          const insights = this.generateOnboardingInsights(
            onboarding.userProfile,
            onboarding.businessContext
          );

          return `Try ${insights.recommendedStartingPoint.toLowerCase()}`;
        }

        return null;

      } catch (error) {
        console.error('Error getting next recommended action:', error);
        return null;
      }
    }
  }