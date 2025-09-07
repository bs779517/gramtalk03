
'use client';
import React, { useEffect, useState } from 'react';
import { useApp } from '@/context/app-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MoreVertical, UserPlus, Phone, Video, MessageSquare, Users, PlusCircle, Wand2, Search, Loader2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { onValue, ref, off, query, orderByChild, equalTo, remove, set, update, get, startAt, endAt } from 'firebase/database';
import type { UserProfile, FriendRequest, CallHistoryItem, Group } from '@/lib/types';
import { FriendSuggestions } from '@/components/friend-suggestions';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import CreateGroupModal from '../modals/create-group-modal';
import { useToast } from '@/hooks/use-toast';

export function MainView() {
  const { firebaseUser, profile, showModal, setActiveView, setChatPartner, startCall, setGroupChat } = useApp();
  const [activeTab, setActiveTab] = useState('chats');
  const [contacts, setContacts] = useState<UserProfile[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [callHistory, setCallHistory] = useState<CallHistoryItem[]>([]);
  const [unreadMessages, setUnreadMessages] = useState<Record<string, number>>({});
  const [groups, setGroups] = useState<Group[]>([]);
  const [isCreateGroupModalOpen, setCreateGroupModalOpen] = useState(false);
  
  // Group Search State
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [groupSearchResults, setGroupSearchResults] = useState<Group[]>([]);
  const [isSearchingGroups, setIsSearchingGroups] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    if (!firebaseUser || !profile) return;

    // Listen for groups
    const userGroupsRef = ref(db, `users/${firebaseUser.uid}/groups`);
    const groupsListener = onValue(userGroupsRef, (snapshot) => {
      const groupIds = snapshot.val() ? Object.keys(snapshot.val()) : [];
      const groupPromises = groupIds.map(id => 
        new Promise<Group | null>((resolve) => {
          onValue(ref(db, `groups/${id}`), (groupSnap) => {
            if (groupSnap.exists()) {
              resolve({ id, ...groupSnap.val()});
            } else {
              // Clean up stale group entries
              remove(ref(db, `users/${firebaseUser.uid}/groups/${id}`));
              resolve(null);
            }
          }, { onlyOnce: true });
        })
      );
      Promise.all(groupPromises).then(groupsData => {
        setGroups(groupsData.filter(Boolean) as Group[]);
      });
    });

    return () => off(userGroupsRef, 'value', groupsListener);
  }, [firebaseUser, profile]);


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
      set(ref(db, `users/${firebaseUser.uid}/contacts/${request.from}`), true),
      set(ref(db, `users/${request.from}/contacts/${firebaseUser.uid}`), true),
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

  const openGroupChat = (group: Group) => {
    setGroupChat(group);
    setActiveView('chat'); 
  };
  
  const handleSearchGroups = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupSearchQuery.trim() || !firebaseUser) return;
    setIsSearchingGroups(true);

    try {
      const groupsRef = ref(db, 'groups');
      const q = query(groupsRef, orderByChild('name'), startAt(groupSearchQuery), endAt(groupSearchQuery + '\uf8ff'));
      const snapshot = await get(q);

      if (snapshot.exists()) {
        const allGroups = snapshot.val();
        const publicGroups = Object.values(allGroups).filter((group: any) => group.isPublic && !group.members[firebaseUser.uid]) as Group[];
        setGroupSearchResults(publicGroups);
        if (publicGroups.length === 0) {
          toast({ title: 'No new groups found', description: 'Try a different search term.'});
        }
      } else {
        setGroupSearchResults([]);
        toast({ title: 'No groups found', description: 'No public groups match your search.'});
      }
    } catch(error) {
       toast({ variant: 'destructive', title: 'Search Error', description: 'Could not perform group search.' });
    } finally {
      setIsSearchingGroups(false);
    }
  }

  const handleJoinGroup = async (group: Group) => {
    if (!firebaseUser) return;
    
    try {
      const updates: Record<string, any> = {};
      updates[`/groups/${group.id}/members/${firebaseUser.uid}`] = true;
      updates[`/users/${firebaseUser.uid}/groups/${group.id}`] = true;
      
      await update(ref(db), updates);

      toast({
        title: 'Joined Group!',
        description: `You are now a member of ${group.name}.`
      });
      
      setGroupSearchResults(prev => prev.filter(g => g.id !== group.id));

    } catch (error) {
       toast({ variant: 'destructive', title: 'Error', description: 'Could not join group.' });
    }
  }


  const NavButton = ({ tabName, icon, label }: { tabName: string, icon: React.ReactNode, label: string }) => {
    const isActive = activeTab === tabName;
    let badgeCount = 0;
    if (tabName === 'chats' && totalUnread > 0) badgeCount = totalUnread;
    if (tabName === 'updates' && friendRequests.length > 0) badgeCount = friendRequests.length;
    
    return (
      <Button
        variant="ghost"
        className={cn("flex flex-col h-auto p-2 gap-1 flex-1 relative", isActive ? "text-primary" : "text-muted-foreground")}
        onClick={() => setActiveTab(tabName)}
      >
        {icon}
        <span className="text-xs">{label}</span>
        {badgeCount > 0 && <Badge className="absolute top-0 right-3 h-5 w-5 p-0 flex items-center justify-center">{badgeCount}</Badge>}
      </Button>
    );
  };
  
  const renderContent = () => {
    switch (activeTab) {
      case 'chats':
        return (
          <div className="p-2">
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
          </div>
        );
      case 'groups':
         return (
          <div className="p-4 space-y-4">
            <div>
              <form onSubmit={handleSearchGroups} className="flex items-center gap-2 mb-4">
                <Input
                  placeholder="Search for public groups..."
                  value={groupSearchQuery}
                  onChange={(e) => setGroupSearchQuery(e.target.value)}
                />
                <Button type="submit" size="icon" disabled={isSearchingGroups}>
                  {isSearchingGroups ? <Loader2 className="animate-spin"/> : <Search />}
                </Button>
              </form>
              {groupSearchResults.length > 0 && (
                <div className="space-y-2">
                   <h3 className="font-semibold px-2 mb-2">Search Results</h3>
                  {groupSearchResults.map(group => (
                    <div key={group.id} className="flex items-center p-2 rounded-lg hover:bg-secondary">
                      <Avatar>
                        <AvatarImage src={group.photoURL ?? undefined} />
                        <AvatarFallback>{group.name.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="ml-3 flex-grow">
                        <p className="font-semibold">{group.name}</p>
                        <p className="text-xs text-muted-foreground">{Object.keys(group.members).length} members</p>
                      </div>
                      <Button size="sm" onClick={() => handleJoinGroup(group)}>Join</Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                  <h3 className="font-semibold px-2">Your Groups</h3>
                   <Button variant="ghost" size="sm" onClick={() => setCreateGroupModalOpen(true)}>
                      <PlusCircle className="mr-2 h-4 w-4"/> New Group
                  </Button>
              </div>
              {groups.length > 0 ? (
                groups.map(group => (
                  <div key={group.id} className="flex items-center p-2 rounded-lg hover:bg-secondary cursor-pointer" onClick={() => openGroupChat(group)}>
                    <Avatar>
                      <AvatarImage src={group.photoURL ?? undefined} />
                      <AvatarFallback>{group.name.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="ml-3 flex-grow">
                      <p className="font-semibold">{group.name}</p>
                      <p className="text-xs text-muted-foreground">{Object.keys(group.members).length} members</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground p-8">No groups yet. Create or search for one to start chatting!</p>
              )}
            </div>
          </div>
        );
      case 'updates':
        return (
          <div className="p-2 space-y-4">
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
          </div>
        );
      case 'calls':
        return (
          <div className="p-2">
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
          </div>
        );
      default:
        return null;
    }
  }

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

      <ScrollArea className="flex-grow">
        {renderContent()}
      </ScrollArea>
      
      <div className="flex justify-around items-center border-t bg-background shadow-inner">
        <NavButton tabName="chats" icon={<MessageSquare />} label="Chats" />
        <NavButton tabName="groups" icon={<Users />} label="Groups" />
        <NavButton tabName="updates" icon={<Wand2 />} label="Updates" />
        <NavButton tabName="calls" icon={<Phone />} label="Calls" />
      </div>

      {profile && (
        <CreateGroupModal
          isOpen={isCreateGroupModalOpen}
          onClose={() => setCreateGroupModalOpen(false)}
          currentUser={profile}
          contacts={contacts}
        />
      )}
    </div>
  );
}

    

