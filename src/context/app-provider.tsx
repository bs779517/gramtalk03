
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

  logout: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const servers = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null | undefined>(undefined);
  const [profile, setProfile] = useState<UserProfile | null | undefined>(undefined);
  const [allUsers, setAllUsers] = useState<Record<string, UserProfile> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [activeView, _setActiveView] = useState<View>('auth');
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [chatPartner, setChatPartnerInternal] = useState<UserProfile | null>(null);
  const [groupChat, setGroupChatInternal] = useState<Group | null>(null);
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);

  // WebRTC State
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  
  const callListeners = useRef<Record<string, () => void>>({});


  const { toast } = useToast();

  const setActiveView = useCallback((view: View) => {
    _setActiveView(view);
    if (typeof window !== 'undefined') {
      if (view === 'chat') {
        window.location.hash = 'chat';
      } else if (view === 'main' && window.location.hash === '#chat') {
        window.history.back();
      } else if (view === 'main') {
        window.location.hash = '';
      }
    }
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash !== '#chat') {
        _setActiveView(prev => (prev === 'chat' ? 'main' : prev));
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);
  
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

  const cleanupCall = useCallback(async (callId?: string, partnerUid?: string) => {
      if (callId) {
        // Clean up Firebase listeners and data
        const currentListeners = callListeners.current;
        for (const key in currentListeners) {
            currentListeners[key]();
            delete currentListeners[key];
        }

        const myUid = firebaseUser?.uid;
        if (myUid) remove(ref(db, `calls/${myUid}/${callId}`));
        if (partnerUid) remove(ref(db, `calls/${partnerUid}/${callId}`));
        remove(ref(db, `iceCandidates/${callId}`));
      }

      // Clean up local WebRTC state
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
      setIsMuted(false);
      setIsVideoEnabled(true);
      const ringtone = document.getElementById('ringtone') as HTMLAudioElement;
      if (ringtone) {
        ringtone.pause();
        ringtone.currentTime = 0;
      }
  }, [localStream, firebaseUser]);


  const endCall = useCallback(async () => {
    if (!activeCall) return;
    const { id, partner } = activeCall;

    const historyRef = ref(db, `callHistory/${firebaseUser!.uid}/${id}`);
    const partnerHistoryRef = ref(db, `callHistory/${partner.uid}/${id}`);

    try {
        await update(historyRef, { status: 'ended' });
        await update(partnerHistoryRef, { status: 'ended' });
    } catch (e) {
        console.error("Error updating call history:", e);
    }
    await cleanupCall(id, partner.uid);
}, [activeCall, firebaseUser, cleanupCall]);


 const startCall = useCallback(async (partner: UserProfile, type: 'video' | 'voice') => {
    if (!firebaseUser || !profile || activeCall) return;

    try {
        const pc = new RTCPeerConnection(servers);
        peerConnection.current = pc;

        const stream = await navigator.mediaDevices.getUserMedia({
            video: type === 'video',
            audio: true,
        });
        setLocalStream(stream);
        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        const remote = new MediaStream();
        setRemoteStream(remote);
        pc.ontrack = event => event.streams[0].getTracks().forEach(track => remote.addTrack(track));

        const callRef = ref(db, `calls/${partner.uid}`);
        const newCallRef = push(callRef);
        const callId = newCallRef.key!;
        
        setActiveCall({ partner, type, id: callId, status: 'ringing' });

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
        await set(newCallRef, callData);

        const historyItem: Omit<CallHistoryItem, 'status'> = {
            id: callId,
            with: { uid: partner.uid, name: partner.name, username: partner.username, photoURL: partner.photoURL },
            type,
            direction: 'outgoing',
            timestamp: Date.now(),
        };
        await set(ref(db, `callHistory/${firebaseUser.uid}/${callId}`), { ...historyItem, status: 'calling' });
        await set(ref(db, `callHistory/${partner.uid}/${callId}`), { ...historyItem, direction: 'incoming', status: 'missed' });


        const answerRef = ref(db, `calls/${firebaseUser.uid}/${callId}/answer`);
        const answerListener = onValue(answerRef, async (snapshot) => {
            const answer = snapshot.val();
            if (answer && pc.signalingState !== 'stable') {
                await pc.setRemoteDescription(new RTCSessionDescription(answer));
                setActiveCall(prev => prev ? { ...prev, status: 'connected' } : null);
                await update(ref(db, `callHistory/${firebaseUser.uid}/${callId}`), { status: 'answered' });
                await update(ref(db, `callHistory/${partner.uid}/${callId}`), { status: 'answered' });
            }
        });

        const calleeCandidatesRef = ref(db, `iceCandidates/${callId}/callee`);
        const calleeCandidatesListener = onValue(calleeCandidatesRef, (snapshot) => {
            snapshot.forEach(childSnapshot => {
                if (pc.signalingState !== 'closed') pc.addIceCandidate(new RTCIceCandidate(childSnapshot.val()));
            });
        });
        
        const partnerCallRef = ref(db, `calls/${partner.uid}/${callId}`);
        const partnerCallListener = onValue(partnerCallRef, (snapshot) => {
            if (!snapshot.exists()) {
                toast({ variant: 'destructive', title: "Call Ended", description: "The other user ended the call." });
                cleanupCall(callId, partner.uid);
            }
        });

        callListeners.current = {
            answerListener: () => off(answerRef, 'value', answerListener),
            calleeCandidatesListener: () => off(calleeCandidatesRef, 'value', calleeCandidatesListener),
            partnerCallListener: () => off(partnerCallRef, 'value', partnerCallListener),
        }

    } catch (error) {
        console.error("Failed to start call:", error);
        toast({ variant: 'destructive', title: "Call Failed", description: "Could not start the call. Check permissions and network." });
        cleanupCall(activeCall?.id, partner.uid);
    }
}, [firebaseUser, profile, activeCall, toast, cleanupCall]);


  const acceptCall = useCallback(async () => {
    if (!incomingCall || !firebaseUser || !profile || activeCall) return;

    try {
        const { id, type, from, offer } = incomingCall;

        const pc = new RTCPeerConnection(servers);
        peerConnection.current = pc;

        const stream = await navigator.mediaDevices.getUserMedia({
            video: type === 'video',
            audio: true,
        });
        setLocalStream(stream);
        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        const remote = new MediaStream();
        setRemoteStream(remote);
        pc.ontrack = event => event.streams[0].getTracks().forEach(track => remote.addTrack(track));

        pc.onicecandidate = event => {
            if (event.candidate) {
                push(ref(db, `iceCandidates/${id}/callee`), event.candidate.toJSON());
            }
        };

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        await set(ref(db, `calls/${from}/${id}/answer`), answer);
        await remove(ref(db, `calls/${firebaseUser.uid}/${id}`));

        const callerCandidatesRef = ref(db, `iceCandidates/${id}/caller`);
        const callerCandidatesListener = onValue(callerCandidatesRef, (snapshot) => {
            snapshot.forEach(childSnapshot => {
                if (pc.signalingState !== 'closed') pc.addIceCandidate(new RTCIceCandidate(childSnapshot.val()));
            });
        });
        
        const partnerCallRef = ref(db, `calls/${from}/${id}`);
        const partnerCallListener = onValue(partnerCallRef, (snapshot) => {
            if (!snapshot.exists()) {
                toast({ variant: 'destructive', title: "Call Ended", description: "The other user ended the call." });
                cleanupCall(id, from);
            }
        });

        callListeners.current = {
            callerCandidatesListener: () => off(callerCandidatesRef, 'value', callerCandidatesListener),
            partnerCallListener: () => off(partnerCallRef, 'value', partnerCallListener),
        }

        const partnerProfile = allUsers?.[from];
        if (partnerProfile) {
            setActiveCall({ partner: partnerProfile, type, id, status: 'connected' });
        }

        setIncomingCall(null);
        showModal(null);
    } catch (error) {
        console.error("Failed to accept call:", error);
        toast({ variant: 'destructive', title: "Call Failed", description: "Could not accept the call." });
        if(incomingCall) cleanupCall(incomingCall.id, incomingCall.from);
    }
  }, [incomingCall, firebaseUser, allUsers, profile, activeCall, toast, cleanupCall]);

  const rejectCall = useCallback(async () => {
    if (!incomingCall || !firebaseUser) return;
    const { id, from } = incomingCall;
    
    await update(ref(db, `callHistory/${from}/${id}`), { status: 'declined' });
    await update(ref(db, `callHistory/${firebaseUser.uid}/${id}`), { status: 'declined' });

    cleanupCall(id, from);
  }, [incomingCall, firebaseUser, cleanupCall]);


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
    if(firebaseUser) {
        const userStatusRef = ref(db, `users/${firebaseUser.uid}`);
        await update(userStatusRef, { onlineStatus: 'offline', lastSeen: Date.now() });
    }
    await auth.signOut();
    cleanupCall(activeCall?.id, activeCall?.partner.uid);
    setFirebaseUser(null);
    setProfile(null);
    setAllUsers(null);
    setActiveView('auth');
    setChatPartner(null);
    setGroupChat(null);
    setActiveModal(null);
  }, [cleanupCall, firebaseUser, activeCall, setActiveView]);

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
  }, [setActiveView]);

  useEffect(() => {
    if (!firebaseUser) return;
    
    let presenceRef: any;
    let connectedListener: any;
    
    if (profile?.username) {
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
          if (window.location.hash === '#chat') {
            _setActiveView('chat');
          } else {
             setActiveView('main');
          }
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
  }, [firebaseUser, setActiveView]);

  const showModal = (modal: ModalType) => setActiveModal(modal);
  
  const value = {
    firebaseUser, profile, allUsers, isLoading, activeView, setActiveView, activeModal, showModal,
    chatPartner, setChatPartner, groupChat, setGroupChat, incomingCall, setIncomingCall, logout,
    updateProfile,
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
