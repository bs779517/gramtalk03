
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
  } = useApp();

  const { toast } = useToast();

  useEffect(() => {
    if (!firebaseUser || !profile) return;
  
    const callsRef = ref(db, `calls/${firebaseUser.uid}`);
    
    const listener = onValue(callsRef, (snapshot) => {
      const callsData = snapshot.val();
      if (callsData) {
        const callKeys = Object.keys(callsData);
        // We only handle one incoming call at a time
        const incomingCallData = callsData[callKeys[0]] as Call;
        
        if (profile?.blocked?.[incomingCallData.from]) {
          // Silently reject if caller is blocked
          return;
        }

        setIncomingCall(incomingCallData);
        showModal('incomingCall');
        
        const ringtone = document.getElementById('ringtone') as HTMLAudioElement;
        if (ringtone) {
          ringtone.play().catch(e => console.error("Ringtone play failed:", e));
        }

      } else {
        // If there are no calls, ensure the modal is closed and ringtone stops.
        setIncomingCall(null);
        showModal(null);
        const ringtone = document.getElementById('ringtone') as HTMLAudioElement;
        if (ringtone) {
          ringtone.pause();
          ringtone.currentTime = 0;
        }
      }
    });
  
    return () => off(callsRef, 'value', listener);
  }, [firebaseUser, profile, setIncomingCall, showModal, toast]);


  const renderView = () => {
    // If we're loading authentication state or profile, show a spinner.
    if (isLoading) {
      return (
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      );
    }

    // If there is no user, or if there is a user but they haven't set up a profile yet.
    if (!firebaseUser) {
      return <AuthView />;
    }
    
    if (!profile?.username) {
        return <AuthView />;
    }

    // Otherwise, the user is authenticated and has a profile.
    switch (activeView) {
      case 'main':
        return <MainView />;
      case 'chat':
        return <ChatView />;
      default:
        // As a fallback, show the main view if the view state is unexpected.
        return <MainView />;
    }
  };

  return (
    <>
      <div className="h-screen w-screen bg-background flex flex-col">
        <div className="relative h-full w-full overflow-hidden flex flex-col">
          {renderView()}
          
          {/* Modals */}
          <AddFriendModal open={activeModal === 'addFriend'} onOpenChange={() => showModal(null)} />
          <ProfileSetupModal open={activeModal === 'profileSetup'} />
          <ProfileModal open={activeModal === 'profileView'} onOpenChange={() => showModal(null)} />
          <IncomingCallModal />
          
          <audio id="ringtone" loop src="/ringtone.mp3"></audio>
        </div>
      </div>
      <CallView />
    </>
  );
}
