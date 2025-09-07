
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
import { ref, query, orderByChild, equalTo, get, push, set, serverTimestamp } from 'firebase/database';
import type { UserProfile } from '@/lib/types';

const formSchema = z.object({
  username: z.string().min(3, { message: 'Username must be at least 3 characters.' }),
});

interface AddFriendModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddFriendModal({ open, onOpenChange }: AddFriendModalProps) {
  const { firebaseUser, profile } = useApp();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { username: '' },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!firebaseUser || !profile) return;
    setIsLoading(true);

    const friendUsername = values.username.toLowerCase();

    if (friendUsername === profile.username) {
      form.setError('username', { message: "You can't add yourself!" });
      setIsLoading(false);
      return;
    }

    try {
      const usersRef = ref(db, 'users');
      const q = query(usersRef, orderByChild('username'), equalTo(friendUsername));
      const snapshot = await get(q);

      if (!snapshot.exists()) {
        form.setError('username', { message: 'User not found.' });
        return;
      }

      const friendData = Object.values(snapshot.val() as Record<string, UserProfile>)[0];
      
      if (profile.contacts && profile.contacts[friendData.uid]) {
         form.setError('username', { message: 'You are already friends.' });
         return;
      }

      const requestsRef = ref(db, 'requests');
      const newRequestRef = push(requestsRef);
      
      await set(newRequestRef, {
        id: newRequestRef.key,
        from: firebaseUser.uid,
        fromName: profile.name,
        fromUsername: profile.username,
        to: friendData.uid,
        createdAt: serverTimestamp(),
      });

      toast({
        title: 'Friend Request Sent',
        description: `Your request has been sent to @${friendUsername}.`,
      });
      onOpenChange(false);
      form.reset();

    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to send friend request. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Friend</DialogTitle>
          <DialogDescription>
            Enter the username of the person you want to add.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input placeholder="their_username" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Sending...' : 'Send Request'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
