// Advanced AI Moderation Service
// Uses OpenAI GPT-4 for sophisticated content analysis

interface AIAnalysisResult {
  sentiment: 'positive' | 'negative' | 'neutral';
  toxicity: number; // 0-1 confidence score
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  topics: string[];
  entities: { type: string; value: string; confidence: number }[];
  brandSafety: number; // 0-1 score
  recommendations: {
    action: 'approve' | 'flag' | 'reject' | 'review';
    confidence: number;
    reasoning: string;
  };
  flags: {
    spam: boolean;
    hateSpeech: boolean;
    harassment: boolean;
    misinformation: boolean;
    inappropriate: boolean;
    scam: boolean;
  };
}

interface ModerationContext {
  platform: string;
  author: {
    id: string;
    name: string;
    verified?: boolean;
    followerCount?: number;
  };
  engagement: {
    likes?: number;
    shares?: number;
    comments?: number;
  };
  brandGuidelines?: string[];
}

class AIModerationService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.openai.com/v1';
  private readonly model = 'gpt-4-turbo-preview';

  constructor() {
    this.apiKey = import.meta.env.VITE_OPENAI_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️ OpenAI API key not found. Using fallback moderation.');
    } else {
      // Only log that key exists, never log the actual key
      const keyPreview = this.apiKey.substring(0, 7) + '...' + this.apiKey.substring(this.apiKey.length - 4);
      console.log('✅ OpenAI API key loaded:', keyPreview);
    }
  }

  // Main content analysis function
  async analyzeContent(
    content: string, 
    context: ModerationContext,
    customRules: any[] = []
  ): Promise<AIAnalysisResult> {
    if (!this.apiKey) {
      return this.fallbackAnalysis(content);
    }

    try {
      console.log('🧠 Analyzing content with AI:', content.substring(0, 100) + '...');
      
      const prompt = this.buildAnalysisPrompt(content, context, customRules);
      
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert content moderator with deep understanding of social media, brand safety, and cultural nuances. Analyze content objectively and provide detailed insights.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.1, // Low temperature for consistent results
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const analysis = this.parseAIResponse(data.choices[0].message.content);
      
      console.log('✅ AI analysis completed:', {
        sentiment: analysis.sentiment,
        toxicity: analysis.toxicity,
        severity: analysis.severity,
        action: analysis.recommendations.action
      });

      return analysis;
    } catch (error) {
      console.error('❌ AI analysis failed:', error);
      return this.fallbackAnalysis(content);
    }
  }

  // Build comprehensive analysis prompt
  private buildAnalysisPrompt(
    content: string, 
    context: ModerationContext,
    customRules: any[]
  ): string {
    return `
Analyze this social media content for moderation purposes:

CONTENT: "${content}"

CONTEXT:
- Platform: ${context.platform}
- Author: ${context.author.name} ${context.author.verified ? '(Verified)' : ''}
- Engagement: ${context.engagement.likes || 0} likes, ${context.engagement.comments || 0} comments
- Follower Count: ${context.author.followerCount || 'Unknown'}

CUSTOM RULES:
${customRules.map(rule => `- ${rule.name}: ${rule.description} (Keywords: ${rule.keywords.join(', ')})`).join('\n')}

Please analyze and respond with a JSON object containing:
{
  "sentiment": "positive|negative|neutral",
  "toxicity": 0.0-1.0,
  "severity": "low|medium|high|critical",
  "category": "string (e.g., 'Spam', 'Hate Speech', 'Normal Content')",
  "topics": ["topic1", "topic2"],
  "entities": [{"type": "person|organization|location", "value": "name", "confidence": 0.0-1.0}],
  "brandSafety": 0.0-1.0,
  "recommendations": {
    "action": "approve|flag|reject|review",
    "confidence": 0.0-1.0,
    "reasoning": "Brief explanation"
  },
  "flags": {
    "spam": boolean,
    "hateSpeech": boolean,
    "harassment": boolean,
    "misinformation": boolean,
    "inappropriate": boolean,
    "scam": boolean
  }
}

Consider:
- Cultural context and nuances
- Sarcasm and humor
- Brand safety implications
- Platform-specific norms
- Potential for viral spread
- Legal and compliance issues
`;
  }

  // Parse AI response into structured format
  private parseAIResponse(response: string): AIAnalysisResult {
    try {
      // Extract JSON from response (handle cases where AI adds explanation)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate and normalize the response
      return {
        sentiment: parsed.sentiment || 'neutral',
        toxicity: Math.max(0, Math.min(1, parsed.toxicity || 0)),
        severity: parsed.severity || 'low',
        category: parsed.category || 'General',
        topics: Array.isArray(parsed.topics) ? parsed.topics : [],
        entities: Array.isArray(parsed.entities) ? parsed.entities : [],
        brandSafety: Math.max(0, Math.min(1, parsed.brandSafety || 0.5)),
        recommendations: {
          action: parsed.recommendations?.action || 'review',
          confidence: Math.max(0, Math.min(1, parsed.recommendations?.confidence || 0.5)),
          reasoning: parsed.recommendations?.reasoning || 'AI analysis completed'
        },
        flags: {
          spam: parsed.flags?.spam || false,
          hateSpeech: parsed.flags?.hateSpeech || false,
          harassment: parsed.flags?.harassment || false,
          misinformation: parsed.flags?.misinformation || false,
          inappropriate: parsed.flags?.inappropriate || false,
          scam: parsed.flags?.scam || false
        }
      };
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      return this.fallbackAnalysis(response);
    }
  }

  // Fallback analysis when AI is unavailable
  private fallbackAnalysis(content: string): AIAnalysisResult {
    const text = content.toLowerCase();
    
    // Simple keyword-based analysis as fallback
    const spamKeywords = ['click here', 'free money', 'win now', 'limited time'];
    const hateKeywords = ['hate', 'stupid', 'idiot', 'kill', 'die'];
    const scamKeywords = ['scam', 'fraud', 'bitcoin', 'investment'];
    
    const hasSpam = spamKeywords.some(keyword => text.includes(keyword));
    const hasHate = hateKeywords.some(keyword => text.includes(keyword));
    const hasScam = scamKeywords.some(keyword => text.includes(keyword));
    
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    let category = 'General';
    let action: 'approve' | 'flag' | 'reject' | 'review' = 'approve';
    
    if (hasScam) {
      severity = 'critical';
      category = 'Scam';
      action = 'reject';
    } else if (hasHate) {
      severity = 'high';
      category = 'Hate Speech';
      action = 'flag';
    } else if (hasSpam) {
      severity = 'medium';
      category = 'Spam';
      action = 'flag';
    }

    return {
      sentiment: 'neutral',
      toxicity: hasHate ? 0.8 : hasSpam ? 0.6 : 0.2,
      severity,
      category,
      topics: [],
      entities: [],
      brandSafety: hasScam ? 0.1 : hasHate ? 0.3 : 0.7,
      recommendations: {
        action,
        confidence: 0.6,
        reasoning: 'Fallback keyword-based analysis'
      },
      flags: {
        spam: hasSpam,
        hateSpeech: hasHate,
        harassment: false,
        misinformation: false,
        inappropriate: hasHate,
        scam: hasScam
      }
    };
  }

  // Batch analysis for multiple content items
  async analyzeBatch(
    contentItems: { content: string; context: ModerationContext }[]
  ): Promise<AIAnalysisResult[]> {
    console.log(`🔄 Analyzing batch of ${contentItems.length} items...`);
    
    const results = await Promise.allSettled(
      contentItems.map(item => this.analyzeContent(item.content, item.context))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        console.error(`Failed to analyze item ${index}:`, result.reason);
        return this.fallbackAnalysis(contentItems[index].content);
      }
    });
  }

  // Get moderation statistics
  getAnalysisStats(analyses: AIAnalysisResult[]) {
    const total = analyses.length;
    const flagged = analyses.filter(a => a.recommendations.action !== 'approve').length;
    const avgToxicity = analyses.reduce((sum, a) => sum + a.toxicity, 0) / total;
    const avgBrandSafety = analyses.reduce((sum, a) => sum + a.brandSafety, 0) / total;
    
    const severityBreakdown = analyses.reduce((acc, a) => {
      acc[a.severity] = (acc[a.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const categoryBreakdown = analyses.reduce((acc, a) => {
      acc[a.category] = (acc[a.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      flagged,
      flaggedPercentage: (flagged / total) * 100,
      avgToxicity,
      avgBrandSafety,
      severityBreakdown,
      categoryBreakdown,
      sentimentBreakdown: analyses.reduce((acc, a) => {
        acc[a.sentiment] = (acc[a.sentiment] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
  }
}

export const aiModerationService = new AIModerationService();
export type { AIAnalysisResult, ModerationContext };
