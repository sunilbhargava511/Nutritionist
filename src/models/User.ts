import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';
import bcrypt from 'bcrypt';

export interface UserAttributes {
  id: string;
  email: string;
  password?: string;
  googleId?: string;
  name: string;
  role: 'nutritionist' | 'patient' | 'admin';
  phone?: string;
  age?: number;
  profilePicture?: string;
  invitationCode?: string;
  nutritionistId?: string;
  brandingConfig?: object;
  isActive: boolean;
  lastLogin?: Date;
  conversationMinutesUsed: number;
  maxFreeMinutes: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'isActive' | 'conversationMinutesUsed' | 'maxFreeMinutes'> {}

export class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: string;
  public email!: string;
  public password?: string;
  public googleId?: string;
  public name!: string;
  public role!: 'nutritionist' | 'patient' | 'admin';
  public phone?: string;
  public age?: number;
  public profilePicture?: string;
  public invitationCode?: string;
  public nutritionistId?: string;
  public brandingConfig?: object;
  public isActive!: boolean;
  public lastLogin?: Date;
  public conversationMinutesUsed!: number;
  public maxFreeMinutes!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Association properties
  public profile?: any;

  public async comparePassword(password: string): Promise<boolean> {
    if (!this.password) return false;
    return bcrypt.compare(password, this.password);
  }

  public static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }
}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    googleId: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM('nutritionist', 'patient', 'admin'),
      allowNull: false,
      defaultValue: 'patient',
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    age: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    profilePicture: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    invitationCode: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    nutritionistId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    brandingConfig: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    conversationMinutesUsed: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },
    maxFreeMinutes: {
      type: DataTypes.FLOAT,
      defaultValue: 3,
    },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    hooks: {
      beforeCreate: async (user) => {
        if (user.password) {
          user.password = await User.hashPassword(user.password);
        }
        if (user.role === 'nutritionist' && !user.invitationCode) {
          user.invitationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('password') && user.password) {
          user.password = await User.hashPassword(user.password);
        }
      },
    },
  }
);

export default User;