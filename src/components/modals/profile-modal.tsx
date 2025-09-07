
'use client';
import { useState, useEffect, useRef } from 'react';
import { useApp } from '@/context/app-provider';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { db } from '@/lib/firebase';
import { ref, onValue, off, remove, update } from 'firebase/database';
import type { UserProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Camera } from 'lucide-react';

interface ProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ProfileModal({ open, onOpenChange }: ProfileModalProps) {
  const { firebaseUser, profile, logout } = useApp();
  const [blockedUsers, setBlockedUsers] = useState<UserProfile[]>([]);
  const [newPhoto, setNewPhoto] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!firebaseUser || !profile?.blocked) {
      setBlockedUsers([]);
      return;
    }

    const blockedIds = Object.keys(profile.blocked);
    const listeners: (() => void)[] = [];

    const fetchBlockedUsers = () => {
      const users: UserProfile[] = [];
      blockedIds.forEach(id => {
        const userRef = ref(db, `users/${id}`);
        const listener = onValue(userRef, (snapshot) => {
          if (snapshot.exists()) {
            const userData = snapshot.val();
            // Remove the old entry if it exists and add the new one
            const userIndex = users.findIndex(u => u.uid === id);
            if (userIndex > -1) {
              users[userIndex] = userData;
            } else {
              users.push(userData);
            }
            setBlockedUsers([...users]);
          }
        });
        listeners.push(() => off(userRef, 'value', listener));
      });
    };

    fetchBlockedUsers();

    return () => {
      listeners.forEach(unsub => unsub());
    };
  }, [firebaseUser, profile?.blocked]);
  
  // Reset photo on modal close
  useEffect(() => {
    if (!open) {
      setNewPhoto(null);
    }
  }, [open]);

  const handleUnblock = async (uid: string) => {
    if (!firebaseUser) return;
    try {
      await remove(ref(db, `users/${firebaseUser.uid}/blocked/${uid}`));
      toast({
        title: 'User Unblocked',
        description: 'They can now contact you and see you in suggestions.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to unblock user. Please try again.',
      });
    }
  };
  
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleSaveChanges = async () => {
    if (!firebaseUser || !newPhoto) return;
    setIsSaving(true);
    try {
      await update(ref(db, `users/${firebaseUser.uid}`), { photoURL: newPhoto });
      toast({
        title: 'Profile Updated',
        description: 'Your new profile picture has been saved.',
      });
      setNewPhoto(null);
    } catch (error) {
       toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save your new picture. Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
  }

  if (!profile) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Your Profile</DialogTitle>
          <DialogDescription>Manage your account settings and preferences.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex flex-col items-center gap-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handlePhotoUpload}
              accept="image/*"
              className="hidden"
            />
            <Avatar className="h-24 w-24 cursor-pointer relative group" onClick={() => fileInputRef.current?.click()}>
              <AvatarImage src={newPhoto ?? profile.photoURL ?? undefined} alt={profile.name} />
              <AvatarFallback className="text-4xl">{profile.name.charAt(0).toUpperCase()}</AvatarFallback>
               <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                  <Camera className="text-white h-8 w-8" />
                </div>
            </Avatar>
            <div>
              <p className="text-xl font-semibold text-center">{profile.name}</p>
              <p className="text-sm text-muted-foreground text-center">@{profile.username}</p>
            </div>
            {newPhoto && (
              <Button size="sm" onClick={handleSaveChanges} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Picture'}
              </Button>
            )}
          </div>
          <div>
            <h3 className="text-sm font-medium mb-2">Blocked Users</h3>
            <ScrollArea className="h-32 rounded-md border p-2">
              {blockedUsers.length > 0 ? (
                blockedUsers.map(user => (
                  <div key={user.uid} className="flex items-center justify-between p-1 rounded hover:bg-secondary">
                    <div className="text-sm">
                      <p className="font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground">@{user.username}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => handleUnblock(user.uid)}>Unblock</Button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center p-4">No blocked users.</p>
              )}
            </ScrollArea>
          </div>
        </div>
        <DialogFooter className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button variant="destructive" onClick={logout}>Log Out</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
