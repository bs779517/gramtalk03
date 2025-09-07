
'use client';

import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useApp } from '@/context/app-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { ref, get, set, query, orderByChild, equalTo } from 'firebase/database';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Camera } from 'lucide-react';
import { Textarea } from '../ui/textarea';

const formSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  username: z.string()
    .min(3, { message: 'Username must be at least 3 characters.' })
    .regex(/^[a-z0-9_.]+$/, { message: 'Username can only contain lowercase letters, numbers, underscores, and periods.' }),
  bio: z.string().max(150, { message: 'Bio cannot be longer than 150 characters.' }).optional(),
});

interface ProfileSetupModalProps {
  open: boolean;
}

export default function ProfileSetupModal({ open }: ProfileSetupModalProps) {
  const { firebaseUser, showModal } = useApp();
  const [isLoading, setIsLoading] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', username: '', bio: '' },
  });

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!firebaseUser) return;
    setIsLoading(true);

    try {
      // Check if username is taken
      const usersRef = ref(db, 'users');
      const q = query(usersRef, orderByChild('username'), equalTo(values.username));
      const snapshot = await get(q);
      
      if (snapshot.exists()) {
        form.setError('username', { message: 'This username is already taken.' });
        setIsLoading(false);
        return;
      }

      // Save profile
      const userProfile = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        name: values.name,
        username: values.username,
        photoURL: photo,
        bio: values.bio || '',
        privacy: {
          profilePhoto: 'everyone',
          about: 'everyone',
          lastSeen: 'everyone',
        },
        onlineStatus: 'online',
        lastSeen: Date.now(),
      };

      await set(ref(db, `users/${firebaseUser.uid}`), userProfile);
      
      toast({
        title: 'Profile Saved',
        description: "Welcome to GramTalk! Let's get you connected.",
      });
      
      showModal(null);
      form.reset();
      setPhoto(null);

    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save profile. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Complete Your Profile</DialogTitle>
          <DialogDescription>
            Choose a display name, a unique username, and a profile picture.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
             <div className="flex flex-col items-center space-y-2">
               <input
                type="file"
                ref={fileInputRef}
                onChange={handlePhotoUpload}
                accept="image/*"
                className="hidden"
              />
              <Avatar className="w-24 h-24 cursor-pointer relative group" onClick={() => fileInputRef.current?.click()}>
                <AvatarImage src={photo ?? undefined} alt="Profile Photo" />
                <AvatarFallback className="text-4xl">
                  {form.watch('name')?.charAt(0) || '?'}
                </AvatarFallback>
                <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                  <Camera className="text-white" />
                </div>
              </Avatar>
              <Button type="button" variant="link" onClick={() => fileInputRef.current?.click()}>
                Set Profile Photo
              </Button>
            </div>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Jane Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input placeholder="jane.doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>About / Bio</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Tell everyone a little about yourself..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? 'Saving...' : 'Save and Continue'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
