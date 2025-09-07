
'use client';
import React, { useEffect } from 'react';
import { useApp } from '@/context/app-provider';
import { AuthView } from './views/auth-view';
import { MainView } from './views/main-view';
import { ChatView } from './views/chat-view';
import { CallView } from './views/call-view';
import AddFriendModal from './modals/add-friend-modal';
import ProfileSetupModal from './modals/profile-setup-modal';
import ProfileModal from './modals/profile-modal';
import IncomingCallModal from './modals/incoming-call-modal';
import { Loader2 } from 'lucide-react';
import { onValue, ref, off } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import type { Call } from '@/lib/types';

export default function AppShell() {
  const { 
    isLoading, 
    firebaseUser, 
    profile, 
    activeView, 
    activeModal, 
    showModal,
    setIncomingCall,
    chatPartner
  } = useApp();

  const { toast } = useToast();

  useEffect(() => {
    if (!firebaseUser) return;
  
    const callsRef = ref(db, `calls/${firebaseUser.uid}`);
    
    const listener = onValue(callsRef, (snapshot) => {
      const callsData = snapshot.val();
      if (callsData) {
        const callKeys = Object.keys(callsData);
        const incomingCallData = callsData[callKeys[0]] as Call;
        
        if (profile?.blocked?.[incomingCallData.from]) {
          // Silently reject if caller is blocked
          return;
        }

        setIncomingCall(incomingCallData);
        showModal('incomingCall');
      }
    });
  
    return () => off(callsRef, 'value', listener);
  }, [firebaseUser, profile, setIncomingCall, showModal, toast]);


  const renderView = () => {
    if (isLoading) {
      return (
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      );
    }

    if (!firebaseUser || (firebaseUser && !profile?.username)) {
      return <AuthView />;
    }

    switch (activeView) {
      case 'main':
        return <MainView />;
      case 'chat':
        return <ChatView />;
      default:
        return <AuthView />;
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-muted/50 p-4">
      <div className="relative h-full w-full max-w-[450px] max-h-[950px] overflow-hidden rounded-2xl bg-background shadow-2xl flex flex-col">
        {renderView()}
        <CallView />

        {/* Modals */}
        <AddFriendModal open={activeModal === 'addFriend'} onOpenChange={() => showModal(null)} />
        <ProfileSetupModal open={activeModal === 'profileSetup'} />
        <ProfileModal open={activeModal === 'profileView'} onOpenChange={() => showModal(null)} />
        <IncomingCallModal />
        
        <audio id="ringtone" loop src="/ringtone.mp3"></audio>
      </div>
    </div>
  );
}
