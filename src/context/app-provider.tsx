
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, onValue, off, remove, set, push, get as getDb } from 'firebase/database';
import { auth, db } from '@/lib/firebase';
import type { FirebaseUser, UserProfile, Call, CallHistoryItem, Group } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

type View = 'auth' | 'main' | 'chat';
type ModalType = 'profileSetup' | 'addFriend' | 'profileView' | 'incomingCall' | null;

interface ActiveCall {
  partner: UserProfile;
  type: 'video' | 'voice';
  id: string;
  status: 'connecting' | 'connected';
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

  // WebRTC State
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);

  const { toast } = useToast();

  const setChatPartner = (user: UserProfile | null) => {
    if (user) setGroupChatInternal(null);
    setChatPartnerInternal(user);
  };

  const setGroupChat = (group: Group | null) => {
    if (group) setChatPartnerInternal(null);
    setGroupChatInternal(group);
  };

  const cleanupCall = useCallback(() => {
    if (peerConnection) {
      peerConnection.close();
      setPeerConnection(null);
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    setRemoteStream(null);
    setActiveCall(null);
    setIsMuted(false);
    setIsVideoEnabled(true);
  }, [peerConnection, localStream]);

  const endCall = useCallback(async () => {
    if (activeCall?.id && firebaseUser?.uid) {
        const historyRef = ref(db, `callHistory/${firebaseUser.uid}/${activeCall.id}`);
        const partnerHistoryRef = ref(db, `callHistory/${activeCall.partner.uid}/${activeCall.id}`);
        
        try {
            const myHistorySnap = await getDb(historyRef);
            const partnerHistorySnap = await getDb(partnerHistoryRef);

            const myUpdate = { status: 'answered' };
            const partnerUpdate = { status: 'answered' };

            if (myHistorySnap.exists()) {
                await set(historyRef, { ...myHistorySnap.val(), ...myUpdate });
            }
            if (partnerHistorySnap.exists()) {
                await set(partnerHistoryRef, { ...partnerHistorySnap.val(), ...partnerUpdate });
            }
        } catch (e) {
            // console.error("Error updating call history:", e);
        }

        await remove(ref(db, `calls/${firebaseUser.uid}/${activeCall.id}`));
        await remove(ref(db, `calls/${activeCall.partner.uid}/${activeCall.id}`));
    }
    cleanupCall();
}, [activeCall, firebaseUser?.uid, cleanupCall]);


  const startCall = useCallback(async (partner: UserProfile, type: 'video' | 'voice') => {
    if (!firebaseUser || !profile) return;
    
    const pc = new RTCPeerConnection(servers);
    setPeerConnection(pc);

    const stream = await navigator.mediaDevices.getUserMedia({
      video: type === 'video',
      audio: true,
    });
    setLocalStream(stream);
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    const remote = new MediaStream();
    setRemoteStream(remote);
    pc.ontrack = event => event.streams[0].getTracks().forEach(track => remote.addTrack(track));

    const callRef = push(ref(db, `calls/${partner.uid}`));
    const callId = callRef.key!;

    pc.onicecandidate = event => {
      if (event.candidate) {
        push(ref(db, `iceCandidates/${callId}/caller`), event.candidate.toJSON());
      }
    };
    
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const callData: Omit<Call, 'answer'> = {
      id: callId,
      type,
      from: firebaseUser.uid,
      fromName: profile.name,
      offer,
      createdAt: Date.now(),
    };
    await set(callRef, callData);
    
    const historyItem: CallHistoryItem = {
        id: callId,
        with: {uid: partner.uid, name: partner.name, username: partner.username},
        type,
        direction: 'outgoing',
        status: 'outgoing',
        timestamp: Date.now(),
    };
    await set(ref(db, `callHistory/${firebaseUser.uid}/${callId}`), historyItem);
    await set(ref(db, `callHistory/${partner.uid}/${callId}`), {...historyItem, direction: 'incoming'});

    setActiveCall({ partner, type, id: callId, status: 'connecting' });

    // Listen for answer
    onValue(ref(db, `calls/${partner.uid}/${callId}`), async (snapshot) => {
      const data = snapshot.val();
      if (data?.answer && pc.signalingState !== 'stable') {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        setActiveCall(prev => prev ? {...prev, status: 'connected'} : null);
      }
      if (!data) { // Call was rejected or ended
          endCall();
      }
    });

    onValue(ref(db, `iceCandidates/${callId}/callee`), (snapshot) => {
      snapshot.forEach(childSnapshot => {
        if(pc.signalingState !== 'closed') pc.addIceCandidate(new RTCIceCandidate(childSnapshot.val()));
      });
    });

  }, [firebaseUser, profile, endCall]);

  const acceptCall = useCallback(async () => {
    if (!incomingCall || !firebaseUser || !profile) return;
    
    const pc = new RTCPeerConnection(servers);
    setPeerConnection(pc);

    const stream = await navigator.mediaDevices.getUserMedia({
      video: incomingCall.type === 'video',
      audio: true,
    });
    setLocalStream(stream);
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    const remote = new MediaStream();
    setRemoteStream(remote);
    pc.ontrack = event => event.streams[0].getTracks().forEach(track => remote.addTrack(track));

    pc.onicecandidate = event => {
      if (event.candidate) {
        push(ref(db, `iceCandidates/${incomingCall.id}/callee`), event.candidate.toJSON());
      }
    };

    await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await set(ref(db, `calls/${firebaseUser.uid}/${incomingCall.id}/answer`), answer);
    
    onValue(ref(db, `iceCandidates/${incomingCall.id}/caller`), (snapshot) => {
        snapshot.forEach(childSnapshot => {
          if(pc.signalingState !== 'closed') pc.addIceCandidate(new RTCIceCandidate(childSnapshot.val()));
        });
    });
    
    const partnerProfile = allUsers?.[incomingCall.from];
    if (partnerProfile) {
      setActiveCall({ partner: partnerProfile, type: incomingCall.type, id: incomingCall.id, status: 'connected' });
    }
    
    setIncomingCall(null);
    showModal(null);
  }, [incomingCall, firebaseUser, allUsers, profile]);

  const rejectCall = useCallback(async () => {
    if (!incomingCall || !firebaseUser) return;
    const { id, from } = incomingCall;
    await remove(ref(db, `calls/${firebaseUser.uid}/${id}`));
    await set(ref(db, `callHistory/${from}/${id}/status`), 'declined');
    await set(ref(db, `callHistory/${firebaseUser.uid}/${id}/status`), 'declined');

    setIncomingCall(null);
    showModal(null);
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
  

  const logout = useCallback(async () => {
    await auth.signOut();
    cleanupCall();
    setFirebaseUser(null);
    setProfile(null);
    setAllUsers(null);
    setActiveView('auth');
    setChatPartner(null);
    setGroupChat(null);
    setActiveModal(null);
  }, [cleanupCall]);

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
    if (!firebaseUser) return;
    const usersRef = ref(db, 'users');
    const usersListener = onValue(usersRef, (snapshot) => setAllUsers(snapshot.val() || {}));
    return () => off(usersRef, 'value', usersListener);
  }, [firebaseUser]);

  useEffect(() => {
    let profileUnsubscribe: () => void;
    if (firebaseUser) {
      setIsLoading(true);
      const profileRef = ref(db, `users/${firebaseUser.uid}`);
      profileUnsubscribe = onValue(profileRef, (snapshot) => {
        const userProfile = snapshot.val();
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
      if (profileUnsubscribe) off(ref(db, `users/${firebaseUser?.uid}`), 'value', profileUnsubscribe);
    };
  }, [firebaseUser]);

  const showModal = (modal: ModalType) => setActiveModal(modal);
  
  const value = {
    firebaseUser, profile, allUsers, isLoading, activeView, setActiveView, activeModal, showModal,
    chatPartner, setChatPartner, groupChat, setGroupChat, incomingCall, setIncomingCall, logout,
    activeCall, localStream, remoteStream, isMuted, isVideoEnabled, toggleMute, toggleVideo,
    startCall, acceptCall, rejectCall, endCall
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) throw new Error('useApp must be used within an AppProvider');
  return context;
};
