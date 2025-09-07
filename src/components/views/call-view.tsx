
'use client';
import { useApp } from '@/context/app-provider';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Mic, MicOff, Video, VideoOff, Phone, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

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
  } = useApp();
  
  const [localVideoRef, setLocalVideoRef] = useState<HTMLVideoElement | null>(null);
  const [remoteVideoRef, setRemoteVideoRef] = useState<HTMLVideoElement | null>(null);

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
  
  if (!activeCall) return null;

  const isVideoCall = activeCall.type === 'video';

  return (
    <div className="absolute inset-0 bg-black z-40 flex flex-col text-white">
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
              className="absolute top-4 right-4 w-24 h-32 object-cover rounded-lg border-2 border-white shadow-lg"
            />
          )}
        </>
      )}

      {/* Overlay */}
      <div className={cn("absolute inset-0 flex flex-col justify-between p-6", !isVideoCall && 'bg-slate-800')}>
        {/* Caller Info */}
        <div className="text-center mt-8">
          <Avatar className={cn("w-24 h-24 mx-auto", isVideoCall ? 'hidden' : 'flex')}>
            {remoteStream ? (
               <AvatarFallback className="text-4xl"><User/></AvatarFallback>
            ) : (
              <AvatarFallback className="text-4xl bg-primary/20 animate-pulse">
                {activeCall.partner.name?.charAt(0).toUpperCase()}
              </AvatarFallback>
            )}
          </Avatar>
          <h2 className="text-3xl font-bold mt-4">{activeCall.partner.name}</h2>
          <p className="text-lg opacity-80">{activeCall.status === 'connecting' ? 'Connecting...' : 'In call'}</p>
        </div>

        {/* Controls */}
        <div className="flex justify-center items-center gap-4">
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
