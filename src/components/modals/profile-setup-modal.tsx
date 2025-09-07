
'use client';

import { useState } from 'react';
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

const formSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  username: z.string()
    .min(3, { message: 'Username must be at least 3 characters.' })
    .regex(/^[a-z0-9_.]+$/, { message: 'Username can only contain lowercase letters, numbers, underscores, and periods.' }),
});

interface ProfileSetupModalProps {
  open: boolean;
}

export default function ProfileSetupModal({ open }: ProfileSetupModalProps) {
  const { firebaseUser, showModal } = useApp();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', username: '' },
  });

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
      };

      await set(ref(db, `users/${firebaseUser.uid}`), userProfile);
      
      toast({
        title: 'Profile Saved',
        description: "Welcome to ChitChat! Let's get you connected.",
      });
      
      // The app provider will automatically detect the profile update and switch views.
      showModal(null);
      form.reset();

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
            Choose a display name and a unique username to get started.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
