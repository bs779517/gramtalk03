
import type { User as FirebaseUser } from 'firebase/auth';

export type { FirebaseUser };

export interface UserProfile {
  uid: string;
  name: string;
  username: string;
  email: string;
  photoURL?: string | null;
  bio?: string;
  lastSeen?: number;
  onlineStatus?: 'online' | 'offline';
  privacy?: {
    profilePhoto: 'everyone' | 'contacts' | 'nobody';
    about: 'everyone' | 'contacts' | 'nobody';
    lastSeen: 'everyone' | 'contacts' | 'nobody';
  };
  blocked?: Record<string, true>;
  contacts?: Record<string, true>;
  groups?: Record<string, true>;
}

export interface Message {
  id: string;
  from: string;
  fromName: string;
  to: string; // Can be a user UID or a group ID
  text: string;
  ts: number;
}

export interface FriendRequest {
  id: string;
  from: string;
to: string;
  fromName: string;
  fromUsername: string;
  createdAt: number;
}

export interface Call {
  id:string;
  type: 'video' | 'voice';
  from: string;
  fromName: string;
  offer: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  createdAt: number;
}

export interface CallHistoryItem {
  id: string;
  with: Partial<UserProfile>;
  type: 'video' | 'voice';
  direction: 'incoming' | 'outgoing';
  status: 'answered' | 'missed' | 'declined' | 'outgoing';
  timestamp: number;
}

export interface Group {
  id: string;
  name: string;
  photoURL: string | null;
  createdBy: string;
  createdAt: number;
  members: Record<string, true>; // UIDs of members
  isPublic?: boolean;
}
    
