export enum Sender {
  USER = 'user',
  BOT = 'bot',
}

export interface Message {
  id: string;
  text: string;
  sender: Sender;
  timestamp: number;
}

export interface Persona {
  id: string;
  name: string;
  title: string;
  color: string;
  avatarInitials: string;
  systemInstruction: string;
  greeting?: string;
  bio: string;
}

export type BotStatus = 'idle' | 'queued' | 'thinking' | 'streaming';

export interface ChatState {
  personaId: string;
  messages: Message[];
  status: BotStatus;
}