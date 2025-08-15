import { User } from '../models/User';

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      name: string;
      role: string;
      [key: string]: any;
    }
  }
}

export interface AuthenticatedRequest extends Express.Request {
  user?: User;
}