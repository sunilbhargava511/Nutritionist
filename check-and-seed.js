const { execSync } = require('child_process');

async function checkAndSeed() {
  try {
    console.log('🔍 Checking database status...');
    
    // First run migrations to ensure database is up to date
    console.log('📦 Running database migrations...');
    execSync('npm run db:migrate', { stdio: 'inherit' });
    
    // Try to seed the database (it will skip if already seeded)
    console.log('🌱 Seeding database...');
    execSync('node -e "require(\'./src/lib/seed-data\').seedDatabase().catch(console.error)"', { stdio: 'inherit' });
    
    console.log('✅ Database check and seed completed!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkAndSeed();