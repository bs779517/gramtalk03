
'use client';
import React, { useEffect, useState, useRef } from 'react';
import { useApp } from '@/context/app-provider';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Phone, Send, Video, Users } from 'lucide-react';
import { db } from '@/lib/firebase';
import { ref, onValue, off, push, serverTimestamp, set } from 'firebase/database';
import type { Message, UserProfile } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';

export function ChatView() {
  const { firebaseUser, profile, chatPartner, groupChat, setActiveView, startCall, allUsers } = useApp();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const isGroupChat = !!groupChat;
  const chatTarget = groupChat || chatPartner;
  const chatPartnerProfile = allUsers && chatPartner ? allUsers[chatPartner.uid] : null;


  const chatId = React.useMemo(() => {
    if (!firebaseUser || !chatTarget) return null;
    if (isGroupChat) return groupChat.id;
    return [firebaseUser.uid, chatPartner!.uid].sort().join('_');
  }, [firebaseUser, chatPartner, groupChat, isGroupChat, chatTarget]);

  useEffect(() => {
    if (!chatId) return;

    const messagesRef = ref(db, `messages/${chatId}`);
    const listener = onValue(messagesRef, (snapshot) => {
      const messagesData = snapshot.val();
      const loadedMessages: Message[] = messagesData
        ? Object.keys(messagesData).map(key => ({ id: key, ...messagesData[key] }))
        : [];
      loadedMessages.sort((a, b) => a.ts - b.ts);
      setMessages(loadedMessages);
    });

    return () => off(messagesRef, 'value', listener);
  }, [chatId]);
  
  useEffect(() => {
    setTimeout(() => {
      const scrollViewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollViewport) {
        scrollViewport.scrollTop = scrollViewport.scrollHeight;
      }
    }, 100);
  }, [messages]);


  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !chatId || !firebaseUser || !chatTarget) return;

    const messagesRef = ref(db, `messages/${chatId}`);
    const newMessageRef = push(messagesRef);

    const message: Omit<Message, 'id'> = {
      from: firebaseUser.uid,
      fromName: profile?.name || 'Unknown User', // Add sender name
      to: isGroupChat ? groupChat.id : chatPartner!.uid,
      text: newMessage.trim(),
      ts: serverTimestamp() as any,
    };

    await set(newMessageRef, message);

    if (!isGroupChat) {
        // Increment unread count for recipient in 1-on-1 chat
        const unreadRef = ref(db, `unread/${chatPartner!.uid}/${firebaseUser.uid}`);
        onValue(unreadRef, (snapshot) => {
            const currentCount = snapshot.val() || 0;
            set(unreadRef, currentCount + 1);
        }, { onlyOnce: true });
    }
    // TODO: Handle group chat notifications if needed

    setNewMessage('');
  };
  
  if (!chatTarget) {
    return (
      <div className="flex h-full items-center justify-center">
        <p>No chat selected.</p>
      </div>
    );
  }

  const getSender = (fromUid: string) => {
    if (!allUsers) return null;
    return allUsers[fromUid] || null;
  };
  
  const getStatus = () => {
      if (isGroupChat) {
          return `${Object.keys(groupChat.members).length} members`;
      }
      if (chatPartnerProfile?.onlineStatus === 'online') {
          return 'Online';
      }
      if (chatPartnerProfile?.lastSeen) {
          return `Last seen ${formatDistanceToNow(chatPartnerProfile.lastSeen, { addSuffix: true })}`;
      }
      return `@${(chatTarget as UserProfile).username}`;
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="flex items-center p-2 border-b gap-2 shadow-sm bg-secondary">
        <Button variant="ghost" size="icon" onClick={() => setActiveView('main')}>
          <ArrowLeft />
        </Button>
        <div className="relative">
          <Avatar>
            <AvatarImage src={isGroupChat ? groupChat.photoURL ?? undefined : (chatPartner as UserProfile)?.photoURL ?? undefined} />
            <AvatarFallback>{chatTarget.name.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
           {!isGroupChat && chatPartnerProfile?.onlineStatus === 'online' && (
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-secondary" />
            )}
        </div>
        <div className="flex-grow">
          <p className="font-semibold">{chatTarget.name}</p>
           <p className="text-xs text-muted-foreground">{getStatus()}</p>
        </div>
        {isGroupChat ? (
             <Button variant="ghost" size="icon">
                <Users />
            </Button>
        ) : (
          <>
            <Button variant="ghost" size="icon" onClick={() => startCall(chatPartner!, 'voice')}>
              <Phone />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => startCall(chatPartner!, 'video')}>
              <Video />
            </Button>
          </>
        )}
      </header>

      <ScrollArea className="flex-grow chat-bg" ref={scrollAreaRef}>
        <div className="p-4 space-y-2">
          {messages.map((msg) => {
            const isMe = msg.from === firebaseUser?.uid;
            
            return (
              <div key={msg.id} className={cn('flex', isMe ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'p-2 px-3 rounded-lg max-w-[80%] relative shadow-sm', 
                  isMe 
                      ? 'bg-[hsl(var(--outgoing-chat-bubble))] rounded-br-none' 
                      : 'bg-card rounded-bl-none'
                  )}>
                    {isGroupChat && !isMe && <p className="text-xs font-semibold text-primary mb-1">{msg.fromName}</p>}
                    <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                    <p className="text-xs text-muted-foreground mt-1 text-right float-right ml-4">
                        {msg.ts ? format(new Date(msg.ts), 'p') : '...'}
                    </p>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <footer className="p-2 border-t bg-secondary">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            autoComplete="off"
            className="flex-grow"
          />
          <Button type="submit" size="icon" disabled={!newMessage.trim()}>
            <Send />
          </Button>
        </form>
      </footer>
    </div>
  );
}
