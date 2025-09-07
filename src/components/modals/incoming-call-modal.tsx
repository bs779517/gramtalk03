
'use client';

import { useApp } from '@/context/app-provider';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Phone, Video, PhoneIncoming, PhoneOff } from 'lucide-react';

export default function IncomingCallModal() {
  const { incomingCall, acceptCall, rejectCall, showModal } = useApp();

  if (!incomingCall) return null;

  const handleAccept = () => {
    acceptCall();
  };

  const handleReject = () => {
    rejectCall();
  };
  
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      rejectCall();
    }
  }

  return (
    <Dialog open={!!incomingCall} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader className="items-center text-center">
          <PhoneIncoming className="w-12 h-12 text-primary mb-2" />
          <DialogTitle className="text-2xl">Incoming Call</DialogTitle>
          <DialogDescription>
            You have an incoming {incomingCall.type} call from...
          </DialogDescription>
        </DialogHeader>
        <div className="text-center my-6">
          <p className="text-2xl font-bold">{incomingCall.fromName}</p>
        </div>
        <div className="flex justify-around mt-4">
          <Button
            variant="destructive"
            size="lg"
            className="rounded-full w-20 h-20"
            onClick={handleReject}
          >
            <PhoneOff className="w-8 h-8" />
          </Button>
          <Button
            variant="default"
            size="lg"
            className="rounded-full w-20 h-20 bg-green-500 hover:bg-green-600"
            onClick={handleAccept}
          >
            {incomingCall.type === 'video' ? <Video className="w-8 h-8" /> : <Phone className="w-8 h-8" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
