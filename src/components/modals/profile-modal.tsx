
'use client';
import { useState, useEffect, useRef } from 'react';
import { useApp } from '@/context/app-provider';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogFooter
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { db } from '@/lib/firebase';
import { ref, onValue, off, remove, update } from 'firebase/database';
import type { UserProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Camera, Edit2, LogOut, MessageSquare, ShieldOff, UserPlus, Video, Settings, MapPin, Users, Cake, VenetianMask } from 'lucide-react';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';
import Image from 'next/image';

interface ProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ProfileModal({ open, onOpenChange }: ProfileModalProps) {
  const { firebaseUser, profile: myProfile, logout, updateProfile, profileToView, setProfileToView, showModal, setChatPartner, setActiveView, startCall } = useApp();
  
  const isMyProfile = !profileToView || (myProfile && profileToView.uid === myProfile.uid);
  const profile = isMyProfile ? myProfile : profileToView;

  // State for various profile fields
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [newPhoto, setNewPhoto] = useState<string | null>(null);
  const [newCoverPhoto, setNewCoverPhoto] = useState<string | null>(null);
  
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const photoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setBio(profile.bio || '');
      setLocation(profile.location || '');
      setIsEditing(false); // Reset editing state when profile changes
    }
  }, [profile]);
  
  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      const timer = setTimeout(() => {
        setIsEditing(false);
        setNewPhoto(null);
        setNewCoverPhoto(null);
        setProfileToView(null);
      }, 300);
      onOpenChange(false);
      return () => clearTimeout(timer);
    }
    onOpenChange(true);
  }

  const handleSaveChanges = async () => {
    if (!firebaseUser || !isMyProfile) return;
    setIsSaving(true);
    
    const updates: Partial<UserProfile> = { name, bio, location };
    if (newPhoto) updates.photoURL = newPhoto;
    if (newCoverPhoto) updates.coverPhotoURL = newCoverPhoto;
    
    try {
      await updateProfile(updates);
      toast({ title: 'Profile Updated', description: 'Your changes have been saved.' });
      setNewPhoto(null);
      setNewCoverPhoto(null);
      setIsEditing(false);
    } catch (error) {
       toast({ variant: 'destructive', title: 'Error', description: 'Failed to save your changes.' });
    } finally {
      setIsSaving(false);
    }
  }
  
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'profile' | 'cover') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        if (type === 'profile') setNewPhoto(result);
        else setNewCoverPhoto(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBlock = async () => {
      if (!firebaseUser || isMyProfile || !profile) return;
      try {
        const isBlockedByMe = myProfile?.blocked && profile && myProfile.blocked[profile.uid];
        const path = isBlockedByMe ? `users/${firebaseUser.uid}/blocked/${profile.uid}` : `users/${firebaseUser.uid}/blocked`;
        if (isBlockedByMe) {
            await remove(ref(db, path));
            toast({ title: 'User Unblocked' });
        } else {
            await update(ref(db, `users/${firebaseUser.uid}`), { [`blocked/${profile.uid}`]: true });
            toast({ title: 'User Blocked' });
        }
        onOpenChange(false);
      } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to update block status.' });
      }
  }

  const handleOpenChat = () => {
    if (profile) {
      setChatPartner(profile);
      setActiveView('chat');
      onOpenChange(false);
    }
  }
  
  const isBlockedByMe = myProfile?.blocked && profile && myProfile.blocked[profile.uid];

  if (!profile || !myProfile) return null;

  const finalCoverPhoto = (isMyProfile && newCoverPhoto) ? newCoverPhoto : profile.coverPhotoURL;
  const finalProfilePhoto = (isMyProfile && newPhoto) ? newPhoto : profile.photoURL;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm p-0 gap-0">
        <div className="relative">
          <input type="file" ref={coverInputRef} onChange={(e) => handlePhotoUpload(e, 'cover')} accept="image/*" className="hidden" />
          <div className="h-28 bg-secondary relative">
             {finalCoverPhoto && <Image src={finalCoverPhoto} layout="fill" objectFit="cover" alt="Cover photo" />}
             {isMyProfile && isEditing && (
                 <Button size="icon" variant="outline" className="absolute bottom-2 right-2 h-8 w-8 rounded-full" onClick={() => coverInputRef.current?.click()}>
                     <Camera className="h-4 w-4" />
                 </Button>
             )}
          </div>
          
          <input type="file" ref={photoInputRef} onChange={(e) => handlePhotoUpload(e, 'profile')} accept="image/*" className="hidden" />
          <div className="absolute top-16 left-1/2 -translate-x-1/2">
             <Avatar className="h-24 w-24 border-4 border-background cursor-pointer relative group" onClick={() => isMyProfile && isEditing && photoInputRef.current?.click()}>
              <AvatarImage src={finalProfilePhoto ?? undefined} alt={profile.name} />
              <AvatarFallback className="text-4xl">{profile.name ? profile.name.charAt(0).toUpperCase() : '?'}</AvatarFallback>
               {isMyProfile && isEditing && (
                <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                  <Camera className="text-white h-8 w-8" />
                </div>
               )}
            </Avatar>
          </div>
        </div>

        <div className="text-center pt-14 pb-4">
            {isMyProfile && isEditing ? (
                <Input className="text-xl font-bold text-center h-auto border-0 focus-visible:ring-1" value={name} onChange={(e) => setName(e.target.value)} />
            ) : (
                 <h2 className="text-xl font-bold">{name}</h2>
            )}
            <p className="text-sm text-muted-foreground">@{profile.username}</p>
        </div>
        
        <div className="flex justify-evenly items-center text-center p-2 border-y">
            <div>
                <p className="font-bold text-lg">{profile.contacts ? Object.keys(profile.contacts).length : 0}</p>
                <p className="text-xs text-muted-foreground">Friends</p>
            </div>
             <div>
                <p className="font-bold text-lg">12</p>
                <p className="text-xs text-muted-foreground">Posts</p>
            </div>
             <div>
                <p className="font-bold text-lg">1.2k</p>
                <p className="text-xs text-muted-foreground">Followers</p>
            </div>
        </div>

        <div className="p-4 space-y-4">
          {isMyProfile && isEditing ? (
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Your bio..." />
          ) : (
            <p className="text-sm text-muted-foreground text-center">{bio || 'No bio yet.'}</p>
          )}
          <div className="space-y-2 text-sm text-muted-foreground">
            {isMyProfile && isEditing ? (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Your location" />
              </div>
            ) : (
              location && <div className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {location}</div>
            )}
            {profile.dob && <div className="flex items-center gap-2"><Cake className="h-4 w-4" /> {profile.dob}</div>}
            {profile.gender && <div className="flex items-center gap-2"><VenetianMask className="h-4 w-4" /> {profile.gender}</div>}
          </div>
          {isBlockedByMe && <p className="text-center text-red-500 text-sm font-bold">You have blocked this user.</p>}
        </div>

        {isMyProfile ? (
          <DialogFooter className="p-4 grid grid-cols-2 gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                <Button onClick={handleSaveChanges} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={logout}><LogOut /> Log Out</Button>
                <Button onClick={() => setIsEditing(true)}><Edit2 /> Edit Profile</Button>
              </>
            )}
          </DialogFooter>
        ) : (
            <div className="p-4 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                     <Button variant="default" onClick={handleOpenChat}><MessageSquare/> Message</Button>
                     <Button variant="outline" onClick={() => startCall(profile, 'video')}><Video/> Call</Button>
                </div>
                 <Button variant="destructive" className="w-full" onClick={handleBlock}>
                  <ShieldOff/> {isBlockedByMe ? 'Unblock' : 'Block'} {profile.name}
                </Button>
            </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

    