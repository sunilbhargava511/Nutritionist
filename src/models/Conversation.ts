import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface ConversationAttributes {
  id: string;
  patientId: string;
  nutritionistId: string;
  mode: 'free-form' | 'structured';
  lessonId?: string;
  startTime: Date;
  endTime?: Date;
  durationMinutes: number;
  transcript: object[];
  summary?: string;
  actionItems?: string[];
  topics?: string[];
  sentiment?: string;
  patientInsights?: object;
  audioRecordingUrl?: string;
  status: 'active' | 'completed' | 'abandoned';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ConversationCreationAttributes extends Optional<ConversationAttributes, 'id' | 'durationMinutes' | 'transcript' | 'status'> {}

export class Conversation extends Model<ConversationAttributes, ConversationCreationAttributes> implements ConversationAttributes {
  public id!: string;
  public patientId!: string;
  public nutritionistId!: string;
  public mode!: 'free-form' | 'structured';
  public lessonId?: string;
  public startTime!: Date;
  public endTime?: Date;
  public durationMinutes!: number;
  public transcript!: object[];
  public summary?: string;
  public actionItems?: string[];
  public topics?: string[];
  public sentiment?: string;
  public patientInsights?: object;
  public audioRecordingUrl?: string;
  public status!: 'active' | 'completed' | 'abandoned';
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Conversation.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    patientId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    nutritionistId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    mode: {
      type: DataTypes.ENUM('free-form', 'structured'),
      allowNull: false,
    },
    lessonId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'lessons',
        key: 'id',
      },
    },
    startTime: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    endTime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    durationMinutes: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },
    transcript: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    summary: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    actionItems: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    topics: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    sentiment: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    patientInsights: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    audioRecordingUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('active', 'completed', 'abandoned'),
      defaultValue: 'active',
    },
  },
  {
    sequelize,
    modelName: 'Conversation',
    tableName: 'conversations',
  }
);

export default Conversation;