
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, onValue, off, remove, set, push, get, serverTimestamp, onDisconnect, update } from 'firebase/database';
import { auth, db } from '@/lib/firebase';
import type { FirebaseUser, UserProfile, Call, CallHistoryItem, Group } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

type View = 'auth' | 'main' | 'chat';
type ModalType = 'profileSetup' | 'addFriend' | 'profileView' | 'incomingCall' | null;

interface ActiveCall {
  partner: UserProfile;
  type: 'video' | 'voice';
  id: string;
  status: 'connecting' | 'connected' | 'ringing';
}

interface AppContextType {
  firebaseUser: FirebaseUser | null | undefined;
  profile: UserProfile | null | undefined;
  allUsers: Record<string, UserProfile> | null;
  isLoading: boolean;
  
  activeView: View;
  setActiveView: (view: View) => void;
  
  activeModal: ModalType;
  showModal: (modal: ModalType) => void;
  
  chatPartner: UserProfile | null;
  setChatPartner: (user: UserProfile | null) => void;
  groupChat: Group | null;
  setGroupChat: (group: Group | null) => void;
  
  updateProfile: (profileData: Partial<UserProfile>) => Promise<void>;

  incomingCall: Call | null;
  setIncomingCall: (call: Call | null) => void;

  activeCall: ActiveCall | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isVideoEnabled: boolean;
  toggleMute: () => void;
  toggleVideo: () => void;
  startCall: (partner: UserProfile, type: 'video' | 'voice') => void;
  acceptCall: () => void;
  rejectCall: () => void;
  endCall: () => void;

  profileToView: UserProfile | null;
  setProfileToView: (profile: UserProfile | null) => void;

  logout: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const servers = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null | undefined>(undefined);
  const [profile, setProfile] = useState<UserProfile | null | undefined>(undefined);
  const [allUsers, setAllUsers] = useState<Record<string, UserProfile> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [activeView, setActiveView] = useState<View>('auth');
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [chatPartner, setChatPartnerInternal] = useState<UserProfile | null>(null);
  const [groupChat, setGroupChatInternal] = useState<Group | null>(null);
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [profileToView, setProfileToView] = useState<UserProfile | null>(null);

  // WebRTC State
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);


  const { toast } = useToast();

  const updateProfile = async (profileData: Partial<UserProfile>) => {
    if (!firebaseUser) return;
    const profileRef = ref(db, `users/${firebaseUser.uid}`);
    await update(profileRef, profileData);
    setProfile(prev => prev ? { ...prev, ...profileData } : null);
  };

  const setChatPartner = (user: UserProfile | null) => {
    if (user) setGroupChatInternal(null);
    setChatPartnerInternal(user);
  };

  const setGroupChat = (group: Group | null) => {
    if (group) setChatPartnerInternal(null);
    setGroupChatInternal(group);
  };

  const cleanupCall = useCallback(async () => {
    // This is a placeholder for call cleanup logic
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    setRemoteStream(null);
    setActiveCall(null);
    setIncomingCall(null);
  }, [localStream]);

  const endCall = useCallback(async () => {
    if (activeCall) {
      // Notify other user (simplified)
      const callEndRef = ref(db, `calls/${activeCall.partner.uid}/${activeCall.id}/end`);
      await set(callEndRef, true);
      cleanupCall();
    }
  }, [activeCall, cleanupCall]);

  const startCall = useCallback(async (partner: UserProfile, type: 'video' | 'voice') => {
    // Placeholder implementation
    toast({ title: "Feature not fully implemented", description: "Starting a call is not fully wired up yet."});
    console.log(`Starting ${type} call with ${partner.name}`);
  }, [toast]);

  const acceptCall = useCallback(async () => {
    // Placeholder implementation
    toast({ title: "Feature not fully implemented", description: "Accepting a call is not fully wired up yet."});
     if(incomingCall) {
        setIncomingCall(null);
        showModal(null);
     }
  }, [incomingCall, toast]);

  const rejectCall = useCallback(async () => {
     if(incomingCall) {
        // Let the caller know the call was rejected
        await remove(ref(db, `calls/${firebaseUser?.uid}/${incomingCall.id}`));
        setIncomingCall(null);
        showModal(null);
     }
  }, [incomingCall, firebaseUser]);


  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => track.enabled = !track.enabled);
      setIsMuted(prev => !prev);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
      setIsVideoEnabled(prev => !prev);
    }
  };
  
  const logout = async () => {
    if(firebaseUser) {
        const userStatusRef = ref(db, `users/${firebaseUser.uid}`);
        await update(userStatusRef, { onlineStatus: 'offline', lastSeen: Date.now() });
    }
    await auth.signOut();
    setFirebaseUser(null);
    setProfile(null);
    setAllUsers(null);
    setActiveView('auth');
    setChatPartner(null);
    setGroupChat(null);
    setActiveModal(null);
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (!user) {
        setProfile(null);
        setAllUsers(null);
        setActiveView('auth');
        setIsLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    let presenceRef: any;
    let connectedListener: any;
    
    if (firebaseUser?.uid && profile?.username) {
        presenceRef = ref(db, `users/${firebaseUser.uid}`);
        connectedListener = onValue(ref(db, '.info/connected'), (snap) => {
          if (snap.val() === true) {
            update(presenceRef, { onlineStatus: 'online' });
            onDisconnect(presenceRef).update({ onlineStatus: 'offline', lastSeen: serverTimestamp() });
          }
        });
    }

    const usersRef = ref(db, 'users');
    const usersListener = onValue(usersRef, (snapshot) => setAllUsers(snapshot.val() || {}));
    
    return () => {
        off(usersRef, 'value', usersListener);
        if (connectedListener && presenceRef) {
          off(ref(db, '.info/connected'), 'value', connectedListener);
        }
    };
  }, [firebaseUser, profile?.username]);

  useEffect(() => {
    let profileUnsubscribe: (() => void) | undefined;
    if (firebaseUser) {
      setIsLoading(true);
      const profileRef = ref(db, `users/${firebaseUser.uid}`);
      profileUnsubscribe = onValue(profileRef, (snapshot) => {
        const userProfile = snapshot.val() as UserProfile;
        setProfile(userProfile);
        if (userProfile?.username) {
          setActiveView('main');
          setActiveModal(null);
        } else if (firebaseUser) {
          setActiveView('auth');
          setActiveModal('profileSetup');
        }
        setIsLoading(false);
      });
    } else {
      setProfile(undefined);
      setIsLoading(false);
    }
    return () => {
      if (profileUnsubscribe) {
        profileUnsubscribe();
      }
    };
  }, [firebaseUser]);

  const showModal = (modal: ModalType) => setActiveModal(modal);
  
  const value = {
    firebaseUser, profile, allUsers, isLoading, activeView, setActiveView, activeModal, showModal,
    chatPartner, setChatPartner, groupChat, setGroupChat, incomingCall, setIncomingCall, logout,
    updateProfile,
    activeCall, localStream, remoteStream, isMuted, isVideoEnabled, toggleMute, toggleVideo,
    startCall, acceptCall, rejectCall, endCall,
    profileToView, setProfileToView
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) throw new Error('useApp must be used within an AppProvider');
  return context;
};
