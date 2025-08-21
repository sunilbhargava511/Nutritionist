import { adminService } from './admin-service';

// Sample educational content chunks for testing
const sampleChunks = [
  {
    title: "Introduction to Retirement Planning Psychology",
    content: `Hello! Welcome to your personalized retirement planning education program. I'm Sanjay Bhargava, and over the next few minutes, I'm going to share some insights that could fundamentally change how you think about retirement.

Here's something most people don't realize: retirement planning isn't really about spreadsheets or complex calculations. It's about understanding your own psychology around money and making decisions that you can actually stick with for decades.

I've seen brilliant engineers create the most sophisticated retirement models, only to panic and sell everything during the first market downturn. Why? Because they optimized for mathematical perfection, not human behavior.

The strategy I'm about to share with you has survived multiple market crashes, including two thousand eight, precisely because it's designed around how people actually behave under stress, not how they should behave in theory.`,
    question: "Before we dive into the specifics, I'm curious - when you think about retirement planning, what worries you most? Is it having enough money, market crashes, or something else entirely?"
  },
  {
    title: "The Two-Fund Simplicity Revolution",
    content: `Great question! Let me address that concern by sharing something that might surprise you. 

The retirement approach I follow uses just two funds. That's it. Not fifteen different investments, not gold, not international funds, not REITs. Just two simple funds that you can manage with your eyes closed.

Here's why this matters: complexity is the enemy of execution. When you have a portfolio with fifteen different investments, what happens when markets get scary? You freeze. You can't possibly track fifteen different things when you're stressed about your financial future.

But with two funds, you always know exactly what you own. Sixty percent in a simple Nifty Fifty index fund to beat inflation over the long haul. Forty percent in an arbitrage fund - super stable and tax-efficient for when you need to make withdrawals.

This isn't just theory. This exact approach survived two thousand eight when complex portfolios failed, because the people using it could actually understand and stick with their strategy.`,
    question: "I know this sounds almost too simple. What's your gut reaction to the idea that just two funds might be better than a diversified portfolio with ten or fifteen investments?"
  },
  {
    title: "The Three Percent Rule That Changes Everything",
    content: `I love that you're thinking critically about this! That questioning attitude is exactly what will serve you well in retirement planning.

Now, here's where the psychology gets really interesting. Most financial advisors will tell you that you can safely withdraw four to six percent from your retirement corpus each year. But I use a three percent rule instead.

Why? Because it's not about mathematical optimization - it's about sleeping well at night.

With a three percent withdrawal rate, you create such a large margin of safety that market downturns become background noise instead of financial emergencies. While other retirees are panicking about their four percent withdrawals during market crashes, you're psychologically bulletproof.

Here's the beautiful part: this approach often allows you to spend MORE money, not less. A three percent withdrawal from a simple, growing portfolio often outperforms a four percent withdrawal from a complex portfolio that you abandon during the first crisis.

Think about it - would you rather have forty thousand rupees per month that you're confident about, or fifty thousand rupees per month that keeps you awake at night?`,
    question: "This psychological approach to retirement planning - focusing on what you can actually stick with rather than theoretical maximums - how does that resonate with your personal experience with money decisions?"
  }
];

export async function seedSampleContent(): Promise<void> {
  try {
    console.log('🌱 Legacy chunk seeding disabled - skipping.');
    return;

  } catch (error) {
    console.error('❌ Failed to seed sample content:', error);
    throw error;
  }
}

export async function createSampleAdminSettings(): Promise<void> {
  try {
    const existingSettings = await adminService.getAdminSettings();
    if (existingSettings) {
      console.log('✅ Admin settings already exist, skipping.');
      return;
    }

    await adminService.updateAdminSettings({
      voiceId: 'pNInz6obpgDQGcFmaJgB', // Adam voice as default
      voiceDescription: 'Professional, warm voice suitable for financial education',
      personalizationEnabled: false, // Start with basic mode
    });
    
    console.log('✅ Sample admin settings created!');
  } catch (error) {
    console.error('❌ Failed to create admin settings:', error);
    throw error;
  }
}

export async function createSampleSystemPrompts(): Promise<void> {
  try {
    const existingPrompts = await adminService.getAllSystemPrompts();
    if (existingPrompts.length > 0) {
      console.log('✅ System prompts already exist, skipping.');
      return;
    }

    // Q&A personalized prompt  
    await adminService.uploadSystemPrompt('qa',
      `You are Sanjay Bhargava, a compassionate financial advisor engaged in personalized dialogue with a client during their educational session.

Your approach:
- Listen carefully to their responses and concerns
- Provide personalized guidance based on their specific situation
- Ask thoughtful follow-up questions to understand their needs better
- Offer practical, actionable advice tailored to their circumstances
- Acknowledge their emotions and concerns around money decisions
- Draw from the conversation history to provide contextual, relevant responses

Personality:
- Warm, empathetic, and non-judgmental
- Professional but personable
- Focus on behavioral aspects of financial planning
- Help them identify patterns and develop sustainable habits
- Encourage progress while being realistic about challenges

Remember: This is an ongoing conversation. Reference previous exchanges and build upon their responses to create a meaningful, personalized experience.`);

    // Report generation prompt
    await adminService.uploadSystemPrompt('report',
      `You are generating a comprehensive session report for a financial education program participant.

Create a structured report that includes:

**Session Overview:**
- Date and duration of session
- Educational topics covered
- Key learning objectives addressed

**Client Insights:**
- Main concerns or goals expressed by the client
- Personal financial situation highlights (if shared)
- Emotional patterns or attitudes toward money observed
- Behavioral insights and tendencies

**Key Takeaways:**
- Most important concepts discussed
- Specific strategies or tools recommended
- Action items the client should focus on

**Recommendations for Next Steps:**
- Areas requiring further education or attention
- Suggested follow-up actions
- Resources that might be helpful

**Session Notes:**
- Notable quotes or insights from the client
- Any specific challenges or breakthroughs mentioned

Format the report professionally but warmly, as if providing notes to a colleague who will be continuing the client relationship.`);

    console.log('✅ Sample system prompts created!');
  } catch (error) {
    console.error('❌ Failed to create system prompts:', error);
    throw error;
  }
}

// Main seeding function
export async function seedDatabase(): Promise<void> {
  try {
    await createSampleAdminSettings();
    await createSampleSystemPrompts();
    await seedSampleContent();
    console.log('🎉 Database seeded successfully!');
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    throw error;
  }
}