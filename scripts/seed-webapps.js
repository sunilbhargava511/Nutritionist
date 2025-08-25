#!/usr/bin/env node
/**
 * Seed Data Script for Multi-Tenant Webapps
 * Creates sample webapp configurations for testing multi-tenant functionality
 */

const Database = require('better-sqlite3');
const path = require('path');

const DATABASE_PATH = process.env.DATABASE_PATH || './database.sqlite';

console.log('🌱 Multi-Tenant Webapp Seed Script');
console.log('===================================\n');

const SAMPLE_WEBAPPS = [
  {
    id: 'nutritionist-main',
    webappKey: 'nutritionist-main',
    serviceDescription: 'Professional nutrition counseling and meal planning services to help you achieve your health goals.',
    keyBenefits: 'Personalized meal plans, Expert nutritional guidance, Weight management support, Improved energy levels',
    businessName: 'Healthy Living Nutrition',
    address: '123 Wellness Avenue, Health City, HC 12345',
    phoneNumber: '+1 (555) 123-4567',
    email: 'info@healthylivingnutrition.com',
    website: 'https://healthylivingnutrition.com',
    lessonsName: 'Nutrition Lessons',
    lessonsDescription: 'Educational videos about healthy eating and nutrition science',
    conversationName: 'Ask a Nutritionist',
    conversationDescription: 'Chat with our AI nutrition expert about your dietary questions',
    subdomain: 'nutrition',
    primaryColor: '#10b981',
    secondaryColor: '#059669',
    accentColor: '#34d399',
    theme: 'light',
    tagline: 'Nourish Your Body, Fuel Your Life',
    welcomeMessage: 'Welcome to your personalized nutrition journey!',
    isActive: true
  },
  {
    id: 'fitness-coach',
    webappKey: 'fitness-coach',
    serviceDescription: 'Complete fitness coaching with personalized workout plans and exercise guidance.',
    keyBenefits: 'Custom workout routines, Form correction, Progress tracking, Motivation and accountability',
    businessName: 'FitLife Personal Training',
    address: '456 Fitness Boulevard, Gym City, GC 67890',
    phoneNumber: '+1 (555) 987-6543',
    email: 'coach@fitlifePT.com',
    website: 'https://fitlifepersonaltraining.com',
    lessonsName: 'Workout Tutorials',
    lessonsDescription: 'Step-by-step exercise demonstrations and fitness education',
    conversationName: 'Fitness Coach Chat',
    conversationDescription: 'Get personalized fitness advice and workout recommendations',
    subdomain: 'fitness',
    primaryColor: '#f59e0b',
    secondaryColor: '#d97706',
    accentColor: '#fbbf24',
    theme: 'dark',
    tagline: 'Transform Your Body, Transform Your Life',
    welcomeMessage: 'Ready to crush your fitness goals? Let\'s get started!',
    isActive: true
  },
  {
    id: 'mental-wellness',
    webappKey: 'mental-wellness',
    serviceDescription: 'Mental wellness coaching and mindfulness training for emotional balance and stress management.',
    keyBenefits: 'Stress reduction techniques, Mindfulness practices, Emotional balance, Better sleep quality',
    businessName: 'Mindful Balance Wellness',
    address: '789 Serenity Lane, Peace Valley, PV 54321',
    phoneNumber: '+1 (555) 246-8135',
    email: 'hello@mindfulbalance.com',
    website: 'https://mindfulbalancewellness.com',
    lessonsName: 'Wellness Workshops',
    lessonsDescription: 'Guided meditation and mental wellness education sessions',
    conversationName: 'Wellness Guide',
    conversationDescription: 'Chat with our AI wellness coach for mindfulness and stress relief',
    subdomain: 'wellness',
    primaryColor: '#8b5cf6',
    secondaryColor: '#7c3aed',
    accentColor: '#a78bfa',
    theme: 'light',
    tagline: 'Find Your Inner Peace',
    welcomeMessage: 'Welcome to your journey toward mental wellness and inner peace.',
    isActive: true
  },
  {
    id: 'financial-advisor',
    webappKey: 'financial-advisor',
    serviceDescription: 'Personal financial planning and investment guidance to secure your financial future.',
    keyBenefits: 'Budget optimization, Investment strategies, Debt management, Retirement planning',
    businessName: 'WealthWise Financial Planning',
    address: '321 Money Street, Finance District, FD 98765',
    phoneNumber: '+1 (555) 369-2580',
    email: 'advisor@wealthwise.com',
    website: 'https://wealthwisefinancial.com',
    lessonsName: 'Financial Education',
    lessonsDescription: 'Learn about investing, budgeting, and financial planning',
    conversationName: 'Financial Advisor',
    conversationDescription: 'Get personalized financial advice and planning assistance',
    subdomain: 'finance',
    primaryColor: '#3b82f6',
    secondaryColor: '#2563eb',
    accentColor: '#60a5fa',
    theme: 'professional',
    tagline: 'Your Path to Financial Freedom',
    welcomeMessage: 'Let\'s build a secure financial future together.',
    isActive: false // Inactive for testing
  }
];

async function seedWebapps() {
  let db;
  
  try {
    db = new Database(DATABASE_PATH);
    console.log(`✅ Connected to database: ${DATABASE_PATH}\n`);
    
    // Check if webapp table exists
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='webapp'").get();
    if (!tableExists) {
      console.log('❌ Webapp table does not exist. Please run database migration first.');
      process.exit(1);
    }
    
    console.log('📝 Creating sample webapp configurations...\n');
    
    // Insert sample webapps
    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO webapp (
        id, webapp_key, service_description, key_benefits,
        business_name, address, phone_number, email, website,
        lessons_name, lessons_description, conversation_name, conversation_description,
        subdomain, primary_color, secondary_color, accent_color, theme,
        tagline, welcome_message, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    let insertedCount = 0;
    
    for (const webapp of SAMPLE_WEBAPPS) {
      try {
        insertStmt.run(
          webapp.id,
          webapp.webappKey,
          webapp.serviceDescription,
          webapp.keyBenefits,
          webapp.businessName,
          webapp.address,
          webapp.phoneNumber,
          webapp.email,
          webapp.website,
          webapp.lessonsName,
          webapp.lessonsDescription,
          webapp.conversationName,
          webapp.conversationDescription,
          webapp.subdomain,
          webapp.primaryColor,
          webapp.secondaryColor,
          webapp.accentColor,
          webapp.theme,
          webapp.tagline,
          webapp.welcomeMessage,
          webapp.isActive ? 1 : 0
        );
        
        console.log(`✅ Created webapp: ${webapp.businessName} (${webapp.webappKey})`);
        insertedCount++;
      } catch (error) {
        console.error(`❌ Failed to insert webapp ${webapp.webappKey}:`, error.message);
      }
    }
    
    console.log(`\n🎉 Successfully created ${insertedCount} webapp configurations!\n`);
    
    // Display summary
    console.log('📊 Webapp Summary:');
    console.log('==================');
    
    const webapps = db.prepare('SELECT webapp_key, business_name, subdomain, is_active FROM webapp ORDER BY webapp_key').all();
    
    webapps.forEach(webapp => {
      const status = webapp.is_active ? '🟢 Active' : '🔴 Inactive';
      const subdomain = webapp.subdomain ? `${webapp.subdomain}.example.com` : 'No subdomain';
      console.log(`${webapp.business_name}`);
      console.log(`   Key: ${webapp.webapp_key}`);
      console.log(`   URL: ${subdomain}`);
      console.log(`   Status: ${status}`);
      console.log('');
    });
    
    console.log('💡 Next Steps:');
    console.log('1. Create admin settings for each webapp');
    console.log('2. Add sample lessons for each webapp');
    console.log('3. Configure opening messages');
    console.log('4. Test webapp switching functionality');
    
  } catch (error) {
    console.error('❌ Error seeding webapps:', error.message);
    
    if (error.code === 'SQLITE_CANTOPEN') {
      console.log('\n💡 Database file not found. Please run the application first to create the database.');
    }
    
    process.exit(1);
  } finally {
    if (db) {
      db.close();
    }
  }
}

// Create admin settings for each webapp
async function seedAdminSettings() {
  let db;
  
  try {
    db = new Database(DATABASE_PATH);
    
    console.log('\n🔧 Creating admin settings for each webapp...\n');
    
    // Get all webapps
    const webapps = db.prepare('SELECT webapp_key FROM webapp').all();
    
    const insertAdminStmt = db.prepare(`
      INSERT OR REPLACE INTO admin_settings (
        id, webapp_key, voice_id, voice_description,
        personalization_enabled, conversation_aware, use_structured_conversation
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    let adminCount = 0;
    
    for (const webapp of webapps) {
      try {
        insertAdminStmt.run(
          `admin-${webapp.webapp_key}`,
          webapp.webapp_key,
          '4n2FYtLoSkOUG7xRbnu9', // Default female voice
          'Professional, clear voice for educational content',
          1, // personalization_enabled
          1, // conversation_aware
          1  // use_structured_conversation
        );
        
        console.log(`✅ Created admin settings for: ${webapp.webapp_key}`);
        adminCount++;
      } catch (error) {
        console.error(`❌ Failed to create admin settings for ${webapp.webapp_key}:`, error.message);
      }
    }
    
    console.log(`\n🎉 Successfully created admin settings for ${adminCount} webapps!`);
    
  } catch (error) {
    console.error('❌ Error seeding admin settings:', error.message);
  } finally {
    if (db) {
      db.close();
    }
  }
}

// Create sample opening messages for each webapp
async function seedOpeningMessages() {
  let db;
  
  try {
    db = new Database(DATABASE_PATH);
    
    console.log('\n💬 Creating opening messages for each webapp...\n');
    
    // Get all webapps
    const webapps = db.prepare('SELECT webapp_key, business_name, welcome_message FROM webapp').all();
    
    const insertMessageStmt = db.prepare(`
      INSERT OR REPLACE INTO opening_messages (
        id, webapp_key, type, message_content, active
      ) VALUES (?, ?, ?, ?, ?)
    `);
    
    let messageCount = 0;
    
    for (const webapp of webapps) {
      try {
        const welcomeMessage = webapp.welcome_message || `Welcome to ${webapp.business_name}! How can I assist you today?`;
        
        insertMessageStmt.run(
          `opening-${webapp.webapp_key}`,
          webapp.webapp_key,
          'general_opening',
          welcomeMessage,
          1 // active
        );
        
        console.log(`✅ Created opening message for: ${webapp.webapp_key}`);
        messageCount++;
      } catch (error) {
        console.error(`❌ Failed to create opening message for ${webapp.webapp_key}:`, error.message);
      }
    }
    
    console.log(`\n🎉 Successfully created opening messages for ${messageCount} webapps!`);
    
  } catch (error) {
    console.error('❌ Error seeding opening messages:', error.message);
  } finally {
    if (db) {
      db.close();
    }
  }
}

// Main execution
async function main() {
  await seedWebapps();
  await seedAdminSettings();
  await seedOpeningMessages();
  
  console.log('\n✨ Multi-tenant webapp seeding complete!');
  console.log('\n🔍 Run the table validation script to verify the setup:');
  console.log('   node scripts/check-tables.js');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  seedWebapps,
  seedAdminSettings,
  seedOpeningMessages,
  SAMPLE_WEBAPPS
};