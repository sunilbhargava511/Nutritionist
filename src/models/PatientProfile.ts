import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface PatientProfileAttributes {
  id: string;
  userId: string;
  allergies: string[];
  dietaryRestrictions: string[];
  healthConditions: string[];
  medications: string[];
  goals: string[];
  preferences: object;
  currentWeight?: number;
  targetWeight?: number;
  height?: number;
  activityLevel?: string;
  mealPreferences?: object;
  notes?: string;
  lastUpdated: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PatientProfileCreationAttributes extends Optional<PatientProfileAttributes, 'id' | 'allergies' | 'dietaryRestrictions' | 'healthConditions' | 'medications' | 'goals' | 'preferences' | 'lastUpdated'> {}

export class PatientProfile extends Model<PatientProfileAttributes, PatientProfileCreationAttributes> implements PatientProfileAttributes {
  public id!: string;
  public userId!: string;
  public allergies!: string[];
  public dietaryRestrictions!: string[];
  public healthConditions!: string[];
  public medications!: string[];
  public goals!: string[];
  public preferences!: object;
  public currentWeight?: number;
  public targetWeight?: number;
  public height?: number;
  public activityLevel?: string;
  public mealPreferences?: object;
  public notes?: string;
  public lastUpdated!: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

PatientProfile.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    allergies: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    dietaryRestrictions: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    healthConditions: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    medications: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    goals: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    preferences: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {},
    },
    currentWeight: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    targetWeight: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    height: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    activityLevel: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    mealPreferences: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    lastUpdated: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'PatientProfile',
    tableName: 'patient_profiles',
  }
);

export default PatientProfile;