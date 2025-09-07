
'use client';

import { useState, useTransition } from 'react';
import { useApp } from '@/context/app-provider';
import { suggestFriendsSharedConnections, SuggestFriendsSharedConnectionsOutput } from '@/ai/flows/suggest-friends-shared-connections';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, UserPlus, Wand2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { push, ref, serverTimestamp, set } from 'firebase/database';

export function FriendSuggestions() {
  const { firebaseUser, profile, allUsers } = useApp();
  const [isPending, startTransition] = useTransition();
  const [suggestions, setSuggestions] = useState<SuggestFriendsSharedConnectionsOutput>([]);
  const { toast } = useToast();

  const handleGetSuggestions = () => {
    if (!firebaseUser || !profile || !allUsers) {
        toast({ variant: "destructive", title: "Error", description: "User data not loaded yet." });
        return;
    }

    startTransition(async () => {
      try {
        const result = await suggestFriendsSharedConnections({
          userUid: firebaseUser.uid,
          contacts: profile.contacts ? Object.keys(profile.contacts) : [],
          allUsers,
        });
        setSuggestions(result);
        if (result.length === 0) {
            toast({ title: "No new suggestions", description: "Looks like you're all caught up!" });
        }
      } catch (error) {
        console.error("AI suggestion error:", error);
        toast({ variant: "destructive", title: "AI Error", description: "Could not generate suggestions." });
      }
    });
  };

  const handleAddFriend = async (friendUid: string, friendUsername: string) => {
    if (!firebaseUser || !profile) return;
    
    const requestsRef = ref(db, 'requests');
    const newRequestRef = push(requestsRef);
    
    await set(newRequestRef, {
      id: newRequestRef.key,
      from: firebaseUser.uid,
      fromName: profile.name,
      fromUsername: profile.username,
      to: friendUid,
      createdAt: serverTimestamp(),
    });

    toast({
      title: 'Friend Request Sent',
      description: `Your request has been sent to @${friendUsername}.`,
    });
    // Remove the suggestion from the list
    setSuggestions(prev => prev.filter(s => s.uid !== friendUid));
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="text-primary" />
          Friend Suggestions
        </CardTitle>
        <CardDescription>Discover new people you might know based on your existing connections.</CardDescription>
      </CardHeader>
      <CardContent>
        {suggestions.length > 0 ? (
          <div className="space-y-3">
            {suggestions.map((suggestion) => (
              <div key={suggestion.uid} className="flex items-center gap-3 p-2 rounded-md hover:bg-secondary">
                <Avatar>
                  <AvatarFallback>{suggestion.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-grow">
                  <p className="font-semibold">{suggestion.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {suggestion.sharedContacts.length} shared connection{suggestion.sharedContacts.length > 1 ? 's' : ''}
                  </p>
                </div>
                <Button size="sm" onClick={() => handleAddFriend(suggestion.uid, suggestion.username)}>
                  <UserPlus className="mr-2 h-4 w-4" /> Add
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-muted-foreground p-4">
            {isPending ? (
              <div className="flex flex-col items-center gap-2">
                 <Loader2 className="h-8 w-8 animate-spin text-primary" />
                 <p>Finding new friends...</p>
              </div>
            ) : (
             <p>Click the button to get AI-powered friend suggestions.</p>
            )}
          </div>
        )}
        <Button onClick={handleGetSuggestions} disabled={isPending} className="w-full mt-4">
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
          {suggestions.length > 0 ? 'Get New Suggestions' : 'Generate Suggestions'}
        </Button>
      </CardContent>
    </Card>
  );
}
