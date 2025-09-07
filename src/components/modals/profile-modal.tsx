
'use client';
import { useState, useEffect } from 'react';
import { useApp } from '@/context/app-provider';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { db } from '@/lib/firebase';
import { ref, onValue, off, remove } from 'firebase/database';
import type { UserProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface ProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ProfileModal({ open, onOpenChange }: ProfileModalProps) {
  const { firebaseUser, profile, logout } = useApp();
  const [blockedUsers, setBlockedUsers] = useState<UserProfile[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (!firebaseUser || !profile?.blocked) {
      setBlockedUsers([]);
      return;
    }

    const blockedIds = Object.keys(profile.blocked);
    const listeners: (() => void)[] = [];

    const fetchBlockedUsers = async () => {
      const users: UserProfile[] = [];
      for (const id of blockedIds) {
        const userRef = ref(db, `users/${id}`);
        const listener = onValue(userRef, (snapshot) => {
          if (snapshot.exists()) {
            users.push(snapshot.val());
            // This is not ideal as it will re-set state on each user load
            // For a small number of blocked users, it's acceptable.
            setBlockedUsers([...users]);
          }
        });
        listeners.push(() => off(userRef, 'value', listener));
      }
    };

    fetchBlockedUsers();

    return () => {
      listeners.forEach(unsub => unsub());
    };
  }, [firebaseUser, profile?.blocked]);

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

  if (!profile) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Your Profile</DialogTitle>
          <DialogDescription>Manage your account settings and preferences.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-2xl">{profile.name.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-xl font-semibold">{profile.name}</p>
              <p className="text-sm text-muted-foreground">@{profile.username}</p>
            </div>
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
