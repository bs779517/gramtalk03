
'use client';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useApp } from '@/context/app-provider';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Phone, Send, Video, Users, Check, CheckCheck, Trash, Reply, X } from 'lucide-react';
import { db } from '@/lib/firebase';
import { ref, onValue, off, push, serverTimestamp, set, update, remove, runTransaction } from 'firebase/database';
import type { Message, UserProfile } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from '@/hooks/use-toast';

// Debounce function
const debounce = <F extends (...args: any[]) => any>(func: F, waitFor: number) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  const debounced = (...args: Parameters<F>) => {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }
    timeout = setTimeout(() => func(...args), waitFor);
  };

  debounced.cancel = () => {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  return debounced;
};


export function ChatView() {
  const { firebaseUser, profile, chatPartner, groupChat, setActiveView, startCall, allUsers } = useApp();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [status, setStatus] = useState('');
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();


  const isGroupChat = !!groupChat;
  const chatTarget = groupChat || chatPartner;
  const chatPartnerProfile = allUsers && chatPartner ? allUsers[chatPartner.uid] : null;


  const chatId = React.useMemo(() => {
    if (!firebaseUser || !chatTarget) return null;
    if (isGroupChat) return groupChat.id;
    return [firebaseUser.uid, chatPartner!.uid].sort().join('_');
  }, [firebaseUser, chatPartner, groupChat, isGroupChat, chatTarget]);


  // Typing indicator logic
  const sendTypingStatus = useCallback((isTyping: boolean) => {
    if (!chatId || !firebaseUser || isGroupChat) return;
    const typingRef = ref(db, `typing/${chatId}/${firebaseUser.uid}`);
    if (isTyping) {
      set(typingRef, true);
    } else {
      remove(typingRef);
    }
  }, [chatId, firebaseUser, isGroupChat]);

  const debouncedSendTypingStatus = useRef(debounce(sendTypingStatus, 2000)).current;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    sendTypingStatus(true);
    debouncedSendTypingStatus(false);
  };


  // Update message status to 'read' when chat is opened
  useEffect(() => {
    if (!chatId || !firebaseUser) return;

    const messagesRef = ref(db, `messages/${chatId}`);
    
    // Set my own messages status to read by partner
    const listener = onValue(messagesRef, (snapshot) => {
      const messagesData = snapshot.val();
      if (messagesData) {
        const updates: Record<string, any> = {};
        Object.keys(messagesData).forEach(key => {
          const msg = messagesData[key];
          if (msg.from !== firebaseUser.uid && msg.status !== 'read') {
            updates[`/${key}/status`] = 'read';
          }
        });
        if (Object.keys(updates).length > 0) {
          update(messagesRef, updates);
        }
      }
    });

    return () => off(messagesRef, 'value', listener);

  }, [chatId, firebaseUser]);

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
      
      // Update incoming messages to 'delivered' if I am the recipient
      if (firebaseUser) {
        const updates: Record<string, any> = {};
        loadedMessages.forEach(msg => {
          const isMyMessage = msg.from === firebaseUser.uid;
          const isToMe = !isGroupChat && msg.to === firebaseUser.uid;
          
          if (!isMyMessage && (isToMe || isGroupChat) && msg.status === 'sent') {
            updates[`/${msg.id}/status`] = 'delivered';
          }
        });
        if (Object.keys(updates).length > 0) {
          update(messagesRef, updates);
        }
      }
    });
    
     // Listen for partner's typing status
    let typingListener: any;
    if (chatPartner) {
        const typingRef = ref(db, `typing/${chatId}/${chatPartner.uid}`);
        typingListener = onValue(typingRef, (snapshot) => {
            setIsPartnerTyping(snapshot.exists());
        });
    }

    return () => {
        off(messagesRef, 'value', listener);
        if (typingListener && chatPartner) {
           const typingRef = ref(db, `typing/${chatId}/${chatPartner.uid}`);
           off(typingRef, 'value', typingListener);
        }
        // Ensure typing status is removed when component unmounts
        if (firebaseUser && chatId && !isGroupChat) {
             const ownTypingRef = ref(db, `typing/${chatId}/${firebaseUser.uid}`);
             remove(ownTypingRef);
        }
    }
  }, [chatId, firebaseUser, chatPartner, isGroupChat]);
  
  useEffect(() => {
    setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, [messages]);

  useEffect(() => {
    if (isPartnerTyping) {
        setStatus('typing...');
    } else if (isGroupChat && groupChat) {
      setStatus(`${Object.keys(groupChat.members).length} members`);
    } else if (chatPartnerProfile) {
      if (chatPartnerProfile.onlineStatus === 'online') {
        setStatus('Online');
      } else if (chatPartnerProfile.lastSeen) {
        setStatus(`Last seen ${formatDistanceToNow(chatPartnerProfile.lastSeen, { addSuffix: true })}`);
      } else {
        setStatus(`@${chatPartnerProfile.username}`);
      }
    }
  }, [chatPartnerProfile, isGroupChat, groupChat, isPartnerTyping]);


  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !chatId || !firebaseUser || !chatTarget || !profile) return;

    // Stop typing indicator on send
    sendTypingStatus(false);
    debouncedSendTypingStatus.cancel?.(); // Cancel any pending debounce
    
    const messagesRef = ref(db, `messages/${chatId}`);
    const newMessageRef = push(messagesRef);

    const message: Omit<Message, 'id'> = {
      from: firebaseUser.uid,
      fromName: profile.name,
      to: isGroupChat ? groupChat.id : chatPartner!.uid,
      text: newMessage.trim(),
      ts: serverTimestamp() as any,
      status: 'sent',
      ...(replyingTo && {
        replyTo: {
          messageId: replyingTo.id,
          messageText: replyingTo.text,
          messageFrom: replyingTo.fromName,
        }
      })
    };

    await set(newMessageRef, message);

    if (!isGroupChat && chatPartner) {
        const unreadRef = ref(db, `unread/${chatPartner.uid}/${firebaseUser.uid}`);
        runTransaction(unreadRef, (currentCount) => (currentCount || 0) + 1);
    }

    setNewMessage('');
    setReplyingTo(null);
    inputRef.current?.focus();
  };
  
  const handleDeleteMessage = async (messageId: string) => {
    if (!chatId) return;
    try {
      await remove(ref(db, `messages/${chatId}/${messageId}`));
      toast({
        title: "Message Deleted",
        description: "The message has been removed.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not delete the message.",
      });
    }
  };

  const handleReplyMessage = (message: Message) => {
    setReplyingTo(message);
    inputRef.current?.focus();
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };


  const renderTicks = (msg: Message) => {
      if (msg.from !== firebaseUser?.uid) return null;

      if (isGroupChat) {
        // Group chat ticks are complex (read by who), so we'll just show sent for now.
        return <Check className="w-4 h-4 text-muted-foreground" />;
      }

      if (msg.status === 'read') {
          return <CheckCheck className="w-4 h-4 text-blue-500" />;
      }
      if (msg.status === 'delivered') {
          return <CheckCheck className="w-4 h-4 text-muted-foreground" />;
      }
      // 'sent' or any other status
      return <Check className="w-4 h-4 text-muted-foreground" />;
  }
  
  if (!chatTarget) {
    return (
      <div className="flex h-full items-center justify-center">
        <p>No chat selected.</p>
      </div>
    );
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
            <AvatarFallback>{chatTarget.name ? chatTarget.name.charAt(0).toUpperCase() : '?'}</AvatarFallback>
          </Avatar>
           {!isGroupChat && chatPartnerProfile?.onlineStatus === 'online' && (
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-secondary" />
            )}
        </div>
        <div className="flex-grow">
          <p className="font-semibold">{chatTarget.name || ""}</p>
           <p className={cn("text-xs", isPartnerTyping ? "text-primary font-semibold" : "text-muted-foreground")}>
            {status}
           </p>
        </div>
        {isGroupChat ? (
             <Button variant="ghost" size="icon">
                <Users />
            </Button>
        ) : (
          <>
            <Button variant="ghost" size="icon" onClick={() => chatPartner && startCall(chatPartner, 'voice')}>
              <Phone />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => chatPartner && startCall(chatPartner, 'video')}>
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
                 <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <div className={cn(
                      'p-2 px-3 rounded-lg max-w-[80%] relative shadow-sm cursor-pointer', 
                      isMe 
                          ? 'bg-[hsl(var(--outgoing-chat-bubble))] rounded-br-none' 
                          : 'bg-card rounded-bl-none'
                      )}>
                        {msg.replyTo && (
                            <div className="p-2 mb-1 rounded-md bg-black/5 border-l-2 border-primary">
                                <p className="font-bold text-primary text-sm">{msg.replyTo.messageFrom}</p>
                                <p className="text-sm text-muted-foreground truncate">{msg.replyTo.messageText}</p>
                            </div>
                        )}
                        {isGroupChat && !isMe && <p className="text-xs font-semibold text-primary mb-1">{msg.fromName}</p>}
                        <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                        <div className="flex items-center justify-end mt-1 text-right float-right ml-4">
                          <p className="text-xs text-muted-foreground mr-1">
                              {msg.ts ? format(new Date(msg.ts), 'p') : '...'}
                          </p>
                          {renderTicks(msg)}
                        </div>
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                     <DropdownMenuItem onClick={() => handleReplyMessage(msg)}>
                        <Reply className="mr-2 h-4 w-4" />
                        <span>Reply</span>
                      </DropdownMenuItem>
                    {isMe && (
                      <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteMessage(msg.id)}>
                        <Trash className="mr-2 h-4 w-4" />
                        <span>Delete</span>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <footer className="p-2 border-t bg-secondary">
        {replyingTo && (
            <div className="p-2 mb-2 rounded-md bg-background border-l-4 border-primary relative">
                <p className="font-bold text-primary">Replying to {replyingTo.fromName}</p>
                <p className="text-sm text-muted-foreground truncate">{replyingTo.text}</p>
                <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={cancelReply}>
                    <X className="h-4 w-4"/>
                </Button>
            </div>
        )}
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <Input
            ref={inputRef}
            value={newMessage}
            onChange={handleInputChange}
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
