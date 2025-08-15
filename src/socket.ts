import { Server as SocketIOServer } from 'socket.io';

let io: SocketIOServer;

export const setSocketIO = (socketInstance: SocketIOServer) => {
  io = socketInstance;
};

export const getSocketIO = (): SocketIOServer => {
  if (!io) {
    throw new Error('Socket.IO instance not initialized. Call setSocketIO first.');
  }
  return io;
};