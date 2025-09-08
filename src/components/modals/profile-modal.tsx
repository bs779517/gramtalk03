
'use client';
import { useState, useEffect, useRef } from 'react';
import { useApp } from '@/context/app-provider';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { db } from '@/lib/firebase';
import { ref, onValue, off, remove, update } from 'firebase/database';
import type { UserProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Camera, Edit2, LogOut, MessageSquare, ShieldOff, UserPlus, Video } from 'lucide-react';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';

interface ProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ProfileModal({ open, onOpenChange }: ProfileModalProps) {
  const { firebaseUser, profile: myProfile, logout, updateProfile, profileToView, setProfileToView, showModal, setChatPartner, setActiveView, startCall } = useApp();
  
  const isMyProfile = !profileToView || profileToView.uid === firebaseUser?.uid;
  const profile = isMyProfile ? myProfile : profileToView;

  // State for various profile fields
  const [name, setName] = useState(profile?.name || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [newPhoto, setNewPhoto] = useState<string | null>(null);
  const [privacy, setPrivacy] = useState(profile?.privacy || { profilePhoto: 'everyone', about: 'everyone', lastSeen: 'everyone' });
  const [onlineStatus, setOnlineStatus] = useState(profile?.onlineStatus === 'online');
  const [blockedUsers, setBlockedUsers] = useState<UserProfile[]>([]);
  
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setBio(profile.bio || '');
      setPrivacy(profile.privacy || { profilePhoto: 'everyone', about: 'everyone', lastSeen: 'everyone' });
      setOnlineStatus(profile.onlineStatus === 'online');
    }
  }, [profile]);
  
  useEffect(() => {
    if (!isMyProfile || !myProfile?.blocked) {
      setBlockedUsers([]);
      return;
    }

    const blockedIds = Object.keys(myProfile.blocked);
    const listeners: (() => void)[] = [];

    const fetchBlockedUsers = () => {
      const users: UserProfile[] = [];
      blockedIds.forEach(id => {
        const userRef = ref(db, `users/${id}`);
        const listener = onValue(userRef, (snapshot) => {
          if (snapshot.exists()) {
            const userData = snapshot.val();
            const userIndex = users.findIndex(u => u.uid === id);
            if (userIndex > -1) users[userIndex] = userData;
            else users.push(userData);
            setBlockedUsers([...users]);
          }
        });
        listeners.push(() => off(userRef, 'value', listener));
      });
    };
    fetchBlockedUsers();
    return () => listeners.forEach(unsub => unsub());
  }, [firebaseUser, myProfile?.blocked, isMyProfile]);
  
  useEffect(() => {
    if (!open) {
      setIsEditingName(false);
      setIsEditingBio(false);
      setNewPhoto(null);
      
      // Reset the viewed profile when modal closes to avoid stale data
      const timer = setTimeout(() => {
        setProfileToView(null);
        if(myProfile) {
          setName(myProfile.name);
          setBio(myProfile.bio || '');
        }
      }, 300); // Delay to allow modal to close gracefully
      
      return () => clearTimeout(timer);
    }
  }, [open, myProfile, setProfileToView]);


  const handleSaveChanges = async () => {
    if (!firebaseUser || !isMyProfile) return;
    setIsSaving(true);
    
    const updates: Partial<UserProfile> = {
      name,
      bio,
      privacy,
      onlineStatus: onlineStatus ? 'online' : 'offline',
      lastSeen: onlineStatus ? Date.now() : profile?.lastSeen
    };
    
    if (newPhoto) {
      updates.photoURL = newPhoto;
    }
    
    try {
      await updateProfile(updates);
      toast({
        title: 'Profile Updated',
        description: 'Your changes have been saved.',
      });
      setNewPhoto(null);
      setIsEditingName(false);
      setIsEditingBio(false);
    } catch (error) {
       toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save your changes. Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
  }
  
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

  const handleUnblock = async (uid: string) => {
    if (!firebaseUser) return;
    try {
      await remove(ref(db, `users/${firebaseUser.uid}/blocked/${uid}`));
      toast({ title: 'User Unblocked' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to unblock user.' });
    }
  };

  const handleBlock = async () => {
      if (!firebaseUser || isMyProfile || !profile) return;
      try {
        await update(ref(db, `users/${firebaseUser.uid}/blocked`), { [profile.uid]: true });
        toast({ title: 'User Blocked' });
        onOpenChange(false);
      } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to block user.' });
      }
  }

  const handleOpenChat = () => {
    if (profile) {
      setChatPartner(profile);
      setActiveView('chat');
      onOpenChange(false); // Close the modal
    }
  }
  
  const isBlockedByMe = myProfile?.blocked && profile && myProfile.blocked[profile.uid];

  if (!profile || !myProfile) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{isMyProfile ? 'Your Profile' : 'Profile'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex flex-col items-center gap-4">
            <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} accept="image/*" className="hidden" />
            <Avatar className="h-24 w-24 cursor-pointer relative group" onClick={() => isMyProfile && fileInputRef.current?.click()}>
              <AvatarImage src={(isMyProfile && newPhoto) ? newPhoto : profile.photoURL ?? undefined} alt={profile.name} />
              <AvatarFallback className="text-4xl">{profile.name ? profile.name.charAt(0).toUpperCase() : '?'}</AvatarFallback>
               {isMyProfile && (
                <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                  <Camera className="text-white h-8 w-8" />
                </div>
               )}
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                {isMyProfile && isEditingName ? (
                  <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setIsEditingName(false)} autoFocus />
                ) : (
                  <p className="text-xl font-semibold text-center">{name}</p>
                )}
                {isMyProfile && <Edit2 className="w-4 h-4 text-muted-foreground cursor-pointer" onClick={() => setIsEditingName(true)} />}
              </div>
              <p className="text-sm text-muted-foreground text-center">@{profile.username}</p>
              {isMyProfile && <p className="text-sm text-muted-foreground text-center mt-1">{profile.email}</p>}
            </div>
             {isBlockedByMe && <Badge variant="destructive">Blocked</Badge>}
          </div>

          {!isMyProfile && !myProfile.contacts?.[profile.uid] && (
             <Button className="w-full" onClick={() => { onOpenChange(false); showModal('addFriend'); }}>
                <UserPlus /> Add Friend
             </Button>
          )}

           {!isMyProfile && (
            <div className="grid grid-cols-2 gap-2">
                 <Button variant="outline" onClick={handleOpenChat}><MessageSquare/> Message</Button>
                 <Button variant="outline" onClick={() => startCall(profile, 'video')}><Video/> Call</Button>
            </div>
           )}

          <Accordion type="single" collapsible className="w-full" defaultValue="about">
            <AccordionItem value="about">
              <AccordionTrigger>About</AccordionTrigger>
              <AccordionContent className="space-y-2">
                {isMyProfile && isEditingBio ? (
                  <Textarea value={bio} onChange={(e) => setBio(e.target.value)} onBlur={() => setIsEditingBio(false)} autoFocus />
                ) : (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{bio || 'No bio yet.'}</p>
                )}
                 {isMyProfile && <Button variant="ghost" size="sm" className="w-full" onClick={() => setIsEditingBio(p => !p)}>
                    {isEditingBio ? 'Done' : 'Edit Bio'}
                 </Button>}
              </AccordionContent>
            </AccordionItem>
            
            {isMyProfile && (
              <AccordionItem value="privacy">
                <AccordionTrigger>Privacy Settings</AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="online-status">Show Online Status</Label>
                    <Switch id="online-status" checked={onlineStatus} onCheckedChange={setOnlineStatus} />
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="privacy-photo">Who can see my profile photo?</Label>
                      <Select value={privacy.profilePhoto} onValueChange={(v) => setPrivacy(p => ({...p, profilePhoto: v as any}))}>
                        <SelectTrigger id="privacy-photo"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="everyone">Everyone</SelectItem>
                          <SelectItem value="contacts">My Contacts</SelectItem>
                          <SelectItem value="nobody">Nobody</SelectItem>
                        </SelectContent>
                      </Select>
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="privacy-about">Who can see my about info?</Label>
                      <Select value={privacy.about} onValueChange={(v) => setPrivacy(p => ({...p, about: v as any}))}>
                        <SelectTrigger id="privacy-about"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="everyone">Everyone</SelectItem>
                          <SelectItem value="contacts">My Contacts</SelectItem>
                          <SelectItem value="nobody">Nobody</SelectItem>
                        </SelectContent>
                      </Select>
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="privacy-lastseen">Who can see my last seen?</Label>
                      <Select value={privacy.lastSeen} onValueChange={(v) => setPrivacy(p => ({...p, lastSeen: v as any}))}>
                        <SelectTrigger id="privacy-lastseen"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="everyone">Everyone</SelectItem>
                          <SelectItem value="contacts">My Contacts</SelectItem>
                          <SelectItem value="nobody">Nobody</SelectItem>
                        </SelectContent>
                      </Select>
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {isMyProfile && (
              <AccordionItem value="blocked">
                <AccordionTrigger>Blocked Users</AccordionTrigger>
                <AccordionContent>
                  <ScrollArea className="h-32">
                    {blockedUsers.length > 0 ? (
                      blockedUsers.map(user => (
                        <div key={user.uid} className="flex items-center justify-between p-1 rounded hover:bg-secondary">
                          <p className="text-sm font-medium">{user.name}</p>
                          <Button size="sm" variant="outline" onClick={() => handleUnblock(user.uid)}>Unblock</Button>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center p-4">No blocked users.</p>
                    )}
                  </ScrollArea>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        </div>
        {isMyProfile ? (
          <DialogFooter className="grid grid-cols-2 gap-2">
            <Button variant="destructive" onClick={logout}><LogOut /> Log Out</Button>
            <Button onClick={handleSaveChanges} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        ) : (
             <DialogFooter>
                <Button variant="destructive" className="w-full" onClick={isBlockedByMe ? () => handleUnblock(profile.uid) : handleBlock}>
                  <ShieldOff/> {isBlockedByMe ? 'Unblock' : 'Block'} {profile.name}
                </Button>
             </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
    

    