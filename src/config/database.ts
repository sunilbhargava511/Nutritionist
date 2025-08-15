import { Sequelize } from 'sequelize';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const databasePath = process.env.DATABASE_URL || path.join(process.cwd(), 'database.sqlite');

export const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: databasePath,
  logging: false,
  define: {
    timestamps: true,
    underscored: true,
  },
});

export const connectDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');
    
    if (process.env.NODE_ENV !== 'production') {
      await sequelize.sync({ force: false });
      console.log('Database synchronized.');
    }
  } catch (error) {
    console.error('Unable to connect to database:', error);
    process.exit(1);
  }
};

export default sequelize;