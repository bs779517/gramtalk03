
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { ref, push, set, serverTimestamp, update } from 'firebase/database';
import type { UserProfile } from '@/lib/types';

const formSchema = z.object({
  groupName: z.string().min(3, { message: 'Group name must be at least 3 characters.' }),
  members: z.array(z.string()).min(1, { message: 'You must select at least one member.' }),
});

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  contacts: UserProfile[];
}

export default function CreateGroupModal({ isOpen, onClose, currentUser, contacts }: CreateGroupModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { groupName: '', members: [] },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true);

    try {
      const groupsRef = ref(db, 'groups');
      const newGroupRef = push(groupsRef);
      const groupId = newGroupRef.key;

      if (!groupId) {
        throw new Error("Could not create group ID.");
      }

      const allMemberUids = [...values.members, currentUser.uid];
      const membersObject = allMemberUids.reduce((acc, uid) => {
        acc[uid] = true;
        return acc;
      }, {} as Record<string, true>);

      const newGroupData = {
        id: groupId,
        name: values.groupName,
        createdBy: currentUser.uid,
        createdAt: serverTimestamp(),
        members: membersObject,
      };

      await set(newGroupRef, newGroupData);

      // Add group to each member's user profile
      const updates: Record<string, any> = {};
      allMemberUids.forEach(uid => {
        updates[`/users/${uid}/groups/${groupId}`] = true;
      });
      await update(ref(db), updates);

      toast({
        title: 'Group Created',
        description: `Group "${values.groupName}" has been created successfully.`,
      });
      form.reset();
      onClose();

    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to create group. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleClose = () => {
      form.reset();
      onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a New Group</DialogTitle>
          <DialogDescription>
            Name your group and select members from your contacts.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="groupName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Group Name</FormLabel>
                  <FormControl>
                    <Input placeholder="My Awesome Group" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="members"
              render={() => (
                <FormItem>
                  <FormLabel>Select Members</FormLabel>
                   <ScrollArea className="h-40 rounded-md border p-2">
                    {contacts.map((contact) => (
                      <FormField
                        key={contact.uid}
                        control={form.control}
                        name="members"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-2 rounded-md hover:bg-secondary">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(contact.uid)}
                                onCheckedChange={(checked) => {
                                  return checked
                                    ? field.onChange([...field.value, contact.uid])
                                    : field.onChange(
                                        field.value?.filter(
                                          (value) => value !== contact.uid
                                        )
                                      )
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal w-full cursor-pointer">
                              {contact.name} (@{contact.username})
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </ScrollArea>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Creating...' : 'Create Group'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

    