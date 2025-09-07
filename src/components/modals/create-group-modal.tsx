
'use client';

import { useState, useRef } from 'react';
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
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Camera } from 'lucide-react';
import { Textarea } from '../ui/textarea';

const formSchema = z.object({
  groupName: z.string().min(3, { message: 'Group name must be at least 3 characters.' }),
  description: z.string().optional(),
  members: z.array(z.string()).min(0),
  isPublic: z.boolean().default(false),
});

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  contacts: UserProfile[];
}

export default function CreateGroupModal({ isOpen, onClose, currentUser, contacts }: CreateGroupModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [groupPhoto, setGroupPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { groupName: '', description: '', members: [], isPublic: false },
  });

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setGroupPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

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
        description: values.description || '',
        photoURL: groupPhoto,
        createdBy: currentUser.uid,
        createdAt: serverTimestamp(),
        members: membersObject,
        isPublic: values.isPublic,
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
      handleClose();

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
      setGroupPhoto(null);
      onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a New Group</DialogTitle>
          <DialogDescription>
            Name your group, set a picture, and select members.
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
                <AvatarImage src={groupPhoto ?? undefined} alt="Group Photo" />
                <AvatarFallback className="text-4xl">
                  {form.watch('groupName')?.charAt(0) || '?'}
                </AvatarFallback>
                <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                  <Camera className="text-white" />
                </div>
              </Avatar>
              <Button type="button" variant="link" onClick={() => fileInputRef.current?.click()}>
                Set Group Photo
              </Button>
            </div>
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="What is this group about?" {...field} />
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
                  <FormLabel>Select Members (from contacts)</FormLabel>
                   <ScrollArea className="h-32 rounded-md border p-2">
                    {contacts.length > 0 ? contacts.map((contact) => (
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
                                    ? field.onChange([...(field.value || []), contact.uid])
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
                    )) : <p className="text-sm text-muted-foreground text-center p-4">Add contacts to invite them to groups.</p>}
                  </ScrollArea>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
                control={form.control}
                name="isPublic"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-2 rounded-md">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="cursor-pointer">
                        Public Group
                      </FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Anyone can find and join this group.
                      </p>
                    </div>
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
    
