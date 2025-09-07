
'use client';
import { useApp } from '@/context/app-provider';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Mic, MicOff, Video, VideoOff, Phone, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';


export function CallView() {
  const {
    activeCall,
    endCall,
    localStream,
    remoteStream,
    isMuted,
    toggleMute,
    isVideoEnabled,
    toggleVideo,
    allUsers
  } = useApp();
  
  const [localVideoRef, setLocalVideoRef] = useState<HTMLVideoElement | null>(null);
  const [remoteVideoRef, setRemoteVideoRef] = useState<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState('Connecting...');

  useEffect(() => {
    if (localVideoRef && localStream) {
      localVideoRef.srcObject = localStream;
    }
  }, [localVideoRef, localStream]);

  useEffect(() => {
    if (remoteVideoRef && remoteStream) {
      remoteVideoRef.srcObject = remoteStream;
    }
  }, [remoteVideoRef, remoteStream]);

  useEffect(() => {
    if (activeCall?.status) {
      setStatus(activeCall.status === 'connecting' ? 'Connecting...' : 'In call');
    }
  }, [activeCall?.status]);
  
  if (!activeCall) return null;

  const isVideoCall = activeCall.type === 'video';
  const partnerName = activeCall.partner.name || 'Unknown User';

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col text-white">
      {/* Video feeds */}
      {isVideoCall && (
        <>
          <video
            ref={setRemoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          {localStream && isVideoEnabled && (
            <video
              ref={setLocalVideoRef}
              autoPlay
              playsInline
              muted
              className="absolute top-4 right-4 w-24 sm:w-32 md:w-40 aspect-[9/16] object-cover rounded-lg border-2 border-white shadow-lg"
            />
          )}
        </>
      )}

      {/* Overlay */}
      <div className={cn("absolute inset-0 flex flex-col justify-between p-6", !isVideoCall && 'bg-slate-800')}>
        {/* Caller Info */}
        <div className="text-center mt-8">
           <div className={cn("flex justify-center", !isVideoCall ? 'mt-16' : 'mt-0')}>
              <Avatar className={cn("w-24 h-24 mx-auto", isVideoCall ? 'hidden' : 'flex')}>
                {remoteStream ? (
                  <AvatarImage src={activeCall.partner.photoURL ?? undefined} />
                ) : (
                  <AvatarFallback className="text-4xl bg-primary/20 animate-pulse">
                    {partnerName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                )}
                <AvatarFallback className="text-4xl">{partnerName.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
           </div>
          <h2 className="text-3xl font-bold mt-4">{partnerName}</h2>
          <p className="text-lg opacity-80">{status}</p>
        </div>

        {/* Controls */}
        <div className="flex justify-center items-center gap-4 mb-8">
          {isVideoCall && (
            <Button
              size="lg"
              variant={isVideoEnabled ? 'secondary' : 'destructive'}
              className="rounded-full w-16 h-16"
              onClick={toggleVideo}
            >
              {isVideoEnabled ? <Video /> : <VideoOff />}
            </Button>
          )}

          <Button
            size="lg"
            variant={isMuted ? 'destructive' : 'secondary'}
            className="rounded-full w-16 h-16"
            onClick={toggleMute}
          >
            {isMuted ? <MicOff /> : <Mic />}
          </Button>

          <Button
            size="lg"
            variant="destructive"
            className="rounded-full w-16 h-16"
            onClick={endCall}
          >
            <Phone />
          </Button>
        </div>
      </div>
       <audio ref={(el) => { if (el && remoteStream && !isVideoCall) el.srcObject = remoteStream; }} autoPlay playsInline className="hidden" />
    </div>
  );
}
