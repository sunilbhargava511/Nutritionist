import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface LessonAttributes {
  id: string;
  nutritionistId: string;
  title: string;
  description?: string;
  content: object[];
  sourceType: 'text' | 'pdf' | 'docx' | 'url' | 'youtube';
  sourceUrl?: string;
  chunkDurationMinutes: number;
  totalDurationMinutes: number;
  tags: string[];
  isPublished: boolean;
  version: number;
  metadata?: object;
  viewCount: number;
  completionCount: number;
  averageRating?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface LessonCreationAttributes extends Optional<LessonAttributes, 'id' | 'isPublished' | 'version' | 'viewCount' | 'completionCount' | 'tags'> {}

export class Lesson extends Model<LessonAttributes, LessonCreationAttributes> implements LessonAttributes {
  public id!: string;
  public nutritionistId!: string;
  public title!: string;
  public description?: string;
  public content!: object[];
  public sourceType!: 'text' | 'pdf' | 'docx' | 'url' | 'youtube';
  public sourceUrl?: string;
  public chunkDurationMinutes!: number;
  public totalDurationMinutes!: number;
  public tags!: string[];
  public isPublished!: boolean;
  public version!: number;
  public metadata?: object;
  public viewCount!: number;
  public completionCount!: number;
  public averageRating?: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Lesson.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    nutritionistId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    content: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    sourceType: {
      type: DataTypes.ENUM('text', 'pdf', 'docx', 'url', 'youtube'),
      allowNull: false,
    },
    sourceUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    chunkDurationMinutes: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 5,
    },
    totalDurationMinutes: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    tags: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    isPublished: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    version: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    viewCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    completionCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    averageRating: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Lesson',
    tableName: 'lessons',
  }
);

export default Lesson;