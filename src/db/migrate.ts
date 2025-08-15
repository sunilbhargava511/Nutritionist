import { connectDatabase } from '../config/database';
import '../models';

const migrate = async () => {
  try {
    console.log('Starting database migration...');
    await connectDatabase();
    console.log('Database migration completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

migrate();