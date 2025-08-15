import { User as UserModel } from '../models/User';

declare global {
  namespace Express {
    interface User extends UserModel {}
  }
}

export interface AuthenticatedRequest extends Express.Request {
  user?: UserModel;
}