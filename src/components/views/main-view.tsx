
'use client';
import React, { useEffect, useState } from 'react';
import { useApp } from '@/context/app-provider';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreVertical, UserPlus, Phone, Video, MessageSquare } from 'lucide-react';
import { db } from '@/lib/firebase';
import { onValue, ref, off, query, orderByChild, equalTo, remove } from 'firebase/database';
import type { UserProfile, FriendRequest, CallHistoryItem } from '@/lib/types';
import { FriendSuggestions } from '@/components/friend-suggestions';
import { formatDistanceToNow } from 'date-fns';

export function MainView() {
  const { firebaseUser, profile, showModal, setActiveView, setChatPartner, startCall } = useApp();
  const [contacts, setContacts] = useState<UserProfile[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [callHistory, setCallHistory] = useState<CallHistoryItem[]>([]);
  const [unreadMessages, setUnreadMessages] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!firebaseUser) return;
    
    // Listen for contacts
    const contactsRef = ref(db, `users/${firebaseUser.uid}/contacts`);
    const contactsListener = onValue(contactsRef, async (snapshot) => {
      const contactIds = snapshot.val() ? Object.keys(snapshot.val()) : [];
      const contactsPromises = contactIds.map(id => 
        new Promise<UserProfile | null>((resolve) => {
          onValue(ref(db, `users/${id}`), (userSnap) => {
            resolve(userSnap.val());
          }, { onlyOnce: true });
        })
      );
      const contactsData = (await Promise.all(contactsPromises)).filter(Boolean) as UserProfile[];
      setContacts(contactsData);
    });

    // Listen for friend requests
    const requestsRef = ref(db, 'requests');
    const requestsQuery = query(requestsRef, orderByChild('to'), equalTo(firebaseUser.uid));
    const requestsListener = onValue(requestsRef, (snapshot) => {
      const allRequests = snapshot.val() || {};
      const userRequests = Object.keys(allRequests)
        .filter(key => allRequests[key].to === firebaseUser.uid)
        .map(key => ({ id: key, ...allRequests[key] }));
      setFriendRequests(userRequests);
    });

    // Listen for unread messages
    const unreadRef = ref(db, `unread/${firebaseUser.uid}`);
    const unreadListener = onValue(unreadRef, (snapshot) => {
      setUnreadMessages(snapshot.val() || {});
    });
    
    // Listen for call history
    const callHistoryRef = ref(db, `callHistory/${firebaseUser.uid}`);
    const callHistoryListener = onValue(callHistoryRef, (snapshot) => {
      const history = snapshot.val() ? Object.values(snapshot.val()) as CallHistoryItem[] : [];
      history.sort((a, b) => b.timestamp - a.timestamp);
      setCallHistory(history);
    });

    return () => {
      off(contactsRef, 'value', contactsListener);
      off(requestsRef, 'value', requestsListener);
      off(unreadRef, 'value', unreadListener);
      off(callHistoryRef, 'value', callHistoryListener);
    };
  }, [firebaseUser]);

  const totalUnread = Object.values(unreadMessages).reduce((acc, count) => acc + count, 0);

  const handleAcceptRequest = async (request: FriendRequest) => {
    if (!firebaseUser) return;
    await Promise.all([
      ref(db, `users/${firebaseUser.uid}/contacts/${request.from}`).set(true),
      ref(db, `users/${request.from}/contacts/${firebaseUser.uid}`).set(true),
      remove(ref(db, `requests/${request.id}`))
    ]);
  };

  const handleRejectRequest = async (request: FriendRequest) => {
    await remove(ref(db, `requests/${request.id}`));
  };

  const openChat = (partner: UserProfile) => {
    setChatPartner(partner);
    setActiveView('chat');
    if (firebaseUser?.uid) {
      remove(ref(db, `unread/${firebaseUser.uid}/${partner.uid}`));
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="bg-primary text-primary-foreground p-4 flex justify-between items-center shadow-md">
        <h1 className="text-xl font-bold">ChitChat</h1>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary/80" onClick={() => showModal('addFriend')}>
            <UserPlus />
          </Button>
          <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary/80" onClick={() => showModal('profileView')}>
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-primary-foreground text-primary text-xs font-bold">
                {profile?.name?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </Button>
        </div>
      </header>

      <Tabs defaultValue="chats" className="flex-grow flex flex-col">
        <TabsList className="w-full justify-around rounded-none">
          <TabsTrigger value="chats" className="flex-1 relative">
            Chats
            {totalUnread > 0 && <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center">{totalUnread}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="updates" className="flex-1 relative">
            Updates
            {friendRequests.length > 0 && <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center">{friendRequests.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="calls" className="flex-1">Calls</TabsTrigger>
        </TabsList>
        <ScrollArea className="flex-grow">
          <TabsContent value="chats" className="p-2">
            {contacts.length > 0 ? (
              contacts.map(contact => (
                <div key={contact.uid} className="flex items-center p-2 rounded-lg hover:bg-secondary cursor-pointer" onClick={() => openChat(contact)}>
                  <Avatar>
                    <AvatarFallback>{contact.name.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="ml-3 flex-grow">
                    <p className="font-semibold">{contact.name}</p>
                    <p className="text-xs text-muted-foreground">@{contact.username}</p>
                  </div>
                  {unreadMessages[contact.uid] > 0 && (
                    <Badge variant="default">{unreadMessages[contact.uid]}</Badge>
                  )}
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground p-8">No contacts yet. Add friends from the Updates tab!</p>
            )}
          </TabsContent>
          <TabsContent value="updates" className="p-2 space-y-4">
             {friendRequests.length > 0 && (
                <div>
                  <h3 className="font-semibold px-2 mb-2">Friend Requests</h3>
                  {friendRequests.map(req => (
                    <div key={req.id} className="flex items-center p-2 rounded-lg hover:bg-secondary">
                      <Avatar><AvatarFallback>{req.fromName.charAt(0)}</AvatarFallback></Avatar>
                      <div className="ml-3 flex-grow">
                        <p className="font-semibold">{req.fromName}</p>
                        <p className="text-xs text-muted-foreground">@{req.fromUsername}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleAcceptRequest(req)}>Accept</Button>
                        <Button size="sm" variant="outline" onClick={() => handleRejectRequest(req)}>Decline</Button>
                      </div>
                    </div>
                  ))}
                </div>
             )}
            <FriendSuggestions />
          </TabsContent>
          <TabsContent value="calls" className="p-2">
             {callHistory.length > 0 ? (
              callHistory.map(call => (
                <div key={call.id} className="flex items-center p-2 rounded-lg hover:bg-secondary">
                  <Avatar>
                    <AvatarFallback>{call.with.name?.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="ml-3 flex-grow">
                    <p className="font-semibold">{call.with.name}</p>
                    <div className="flex items-center text-xs text-muted-foreground">
                      {call.direction === 'incoming' ? 'Incoming' : 'Outgoing'} {call.type} call &middot; {call.status}
                    </div>
                     <p className="text-xs text-muted-foreground">{formatDistanceToNow(call.timestamp, { addSuffix: true })}</p>
                  </div>
                   <div className="flex gap-2">
                     <Button size="icon" variant="ghost" onClick={() => call.with && startCall(call.with as UserProfile, 'voice')}><Phone/></Button>
                     <Button size="icon" variant="ghost" onClick={() => call.with && startCall(call.with as UserProfile, 'video')}><Video/></Button>
                   </div>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground p-8">No recent calls.</p>
            )}
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}
