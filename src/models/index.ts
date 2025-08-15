import User from './User';
import Lesson from './Lesson';
import Conversation from './Conversation';
import PatientProfile from './PatientProfile';

// Define associations
User.hasMany(Lesson, {
  foreignKey: 'nutritionistId',
  as: 'lessons',
});

Lesson.belongsTo(User, {
  foreignKey: 'nutritionistId',
  as: 'nutritionist',
});

User.hasMany(Conversation, {
  foreignKey: 'patientId',
  as: 'patientConversations',
});

User.hasMany(Conversation, {
  foreignKey: 'nutritionistId',
  as: 'nutritionistConversations',
});

Conversation.belongsTo(User, {
  foreignKey: 'patientId',
  as: 'patient',
});

Conversation.belongsTo(User, {
  foreignKey: 'nutritionistId',
  as: 'nutritionist',
});

Conversation.belongsTo(Lesson, {
  foreignKey: 'lessonId',
  as: 'lesson',
});

Lesson.hasMany(Conversation, {
  foreignKey: 'lessonId',
  as: 'conversations',
});

User.hasOne(PatientProfile, {
  foreignKey: 'userId',
  as: 'profile',
});

PatientProfile.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

User.hasMany(User, {
  foreignKey: 'nutritionistId',
  as: 'patients',
});

User.belongsTo(User, {
  foreignKey: 'nutritionistId',
  as: 'nutritionist',
});

export {
  User,
  Lesson,
  Conversation,
  PatientProfile,
};