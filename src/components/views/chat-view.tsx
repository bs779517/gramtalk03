
'use client';
import React, { useEffect, useState, useRef } from 'react';
import { useApp } from '@/context/app-provider';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Phone, Send, Video } from 'lucide-react';
import { db } from '@/lib/firebase';
import { ref, onValue, off, push, serverTimestamp, set } from 'firebase/database';
import type { Message, UserProfile } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export function ChatView() {
  const { firebaseUser, chatPartner, setActiveView, startCall } = useApp();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const chatId = React.useMemo(() => {
    if (!firebaseUser || !chatPartner) return null;
    return [firebaseUser.uid, chatPartner.uid].sort().join('_');
  }, [firebaseUser, chatPartner]);

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
    if (!newMessage.trim() || !chatId || !firebaseUser || !chatPartner) return;

    const messagesRef = ref(db, `messages/${chatId}`);
    const newMessageRef = push(messagesRef);

    const message: Omit<Message, 'id'> = {
      from: firebaseUser.uid,
      to: chatPartner.uid,
      text: newMessage.trim(),
      ts: serverTimestamp() as any,
    };

    await set(newMessageRef, message);

    // Increment unread count for recipient
    const unreadRef = ref(db, `unread/${chatPartner.uid}/${firebaseUser.uid}`);
    onValue(unreadRef, (snapshot) => {
      const currentCount = snapshot.val() || 0;
      set(unreadRef, currentCount + 1);
    }, { onlyOnce: true });

    setNewMessage('');
  };
  
  if (!chatPartner) {
    return (
      <div className="flex h-full items-center justify-center">
        <p>No chat selected.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="flex items-center p-2 border-b gap-2 shadow-sm">
        <Button variant="ghost" size="icon" onClick={() => setActiveView('main')}>
          <ArrowLeft />
        </Button>
        <Avatar>
          <AvatarFallback>{chatPartner.name.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-grow">
          <p className="font-semibold">{chatPartner.name}</p>
          <p className="text-xs text-muted-foreground">@{chatPartner.username}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => startCall(chatPartner, 'voice')}>
          <Phone />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => startCall(chatPartner, 'video')}>
          <Video />
        </Button>
      </header>

      <ScrollArea className="flex-grow chat-bg" ref={scrollAreaRef}>
        <div className="p-4 space-y-4">
          {messages.map((msg, index) => {
            const isMe = msg.from === firebaseUser?.uid;
            return (
              <div
                key={msg.id}
                className={cn('flex', isMe ? 'justify-end' : 'justify-start')}
              >
                <div className={cn(
                  'p-3 rounded-2xl max-w-[75%]', 
                  isMe 
                    ? 'bg-primary text-primary-foreground rounded-br-none' 
                    : 'bg-card text-card-foreground rounded-bl-none'
                )}>
                  <p className="text-sm">{msg.text}</p>
                  <p className="text-xs opacity-70 mt-1 text-right">{format(new Date(msg.ts), 'p')}</p>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <footer className="p-2 border-t bg-background">
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
