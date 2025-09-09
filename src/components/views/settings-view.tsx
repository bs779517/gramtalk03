
'use client';

import React from 'react';
import { useApp } from '@/context/app-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  User,
  Shield,
  MessageSquare,
  Bell,
  Palette,
  Database,
  HelpCircle,
  FileText,
  ChevronRight,
  LogOut,
  Trash2,
  Brush,
  Save,
  Languages,
  Info,
  ShieldOff
} from 'lucide-react';
import { Separator } from '../ui/separator';

interface SettingsViewProps {
  onBack: () => void;
}

const SettingsListItem = ({ icon, title, description, action }: { icon: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) => (
    <div className="flex items-center py-3">
      <div className="mr-4 text-primary">{icon}</div>
      <div className="flex-grow">
        <p className="font-medium">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
);

export function SettingsView({ onBack }: SettingsViewProps) {
  const { logout } = useApp();

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">

        {/* 1. Account Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><User /> Account</CardTitle>
            <CardDescription>Manage your profile and account settings.</CardDescription>
          </CardHeader>
          <CardContent>
            <SettingsListItem icon={<Info />} title="Edit Profile" description="Name, username, DP, bio" action={<ChevronRight />} />
            <Separator />
            <SettingsListItem icon={<User />} title="Phone/Email" description="Change your contact info" action={<ChevronRight />} />
            <Separator />
            <SettingsListItem icon={<FileText />} title="Change Password" action={<ChevronRight />} />
            <Separator />
            <SettingsListItem icon={<LogOut />} title="Logout" action={<Button variant="outline" size="sm" onClick={logout}>Logout</Button>} />
            <Separator />
            <SettingsListItem icon={<Trash2 className="text-destructive"/>} title="Delete Account" description="This action is permanent" action={<Button variant="destructive" size="sm">Delete</Button>} />
          </CardContent>
        </Card>

        {/* 2. Privacy & Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Shield /> Privacy & Security</CardTitle>
            <CardDescription>Control who can see your info and secure your account.</CardDescription>
          </CardHeader>
          <CardContent>
            <SettingsListItem icon={<Info />} title="Last Seen / Online Status" action={<Switch defaultChecked />} />
            <Separator />
            <SettingsListItem icon={<MessageSquare />} title="Read Receipts (Blue Ticks)" action={<Switch defaultChecked />} />
            <Separator />
            <SettingsListItem icon={<User />} title="Who can message me" action={
              <Select defaultValue="everyone">
                <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="everyone">Everyone</SelectItem>
                  <SelectItem value="contacts">Contacts</SelectItem>
                </SelectContent>
              </Select>
            }/>
            <Separator />
            <SettingsListItem icon={<ShieldOff />} title="Blocked Users" action={<ChevronRight />} />
            <Separator />
             <SettingsListItem icon={<FileText />} title="Two-Factor Authentication" description="Off" action={<ChevronRight />} />
             <Separator />
             <SettingsListItem icon={<Database />} title="Active Sessions" description="Manage logged in devices" action={<ChevronRight />} />
          </CardContent>
        </Card>
        
        {/* 3. Chats Settings */}
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><MessageSquare /> Chat Settings</CardTitle>
            </CardHeader>
            <CardContent>
                <SettingsListItem icon={<Save />} title="Chat Backup & Restore" action={<ChevronRight />} />
                <Separator />
                <SettingsListItem icon={<Trash2 />} title="Clear All Chats" action={<Button variant="outline" size="sm">Clear</Button>} />
                <Separator />
                <SettingsListItem icon={<Bell />} title="Mute Notifications" action={<Switch />} />
                <Separator />
                <SettingsListItem icon={<Brush />} title="Wallpaper & Chat Theme" action={<ChevronRight />} />
                <Separator />
                <SettingsListItem icon={<FileText />} title="Font Size" action={
                     <Select defaultValue="medium">
                        <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                        <SelectItem value="small">Small</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="large">Large</SelectItem>
                        </SelectContent>
                    </Select>
                } />
            </CardContent>
        </Card>

        {/* 4. Notifications */}
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Bell /> Notifications</CardTitle>
            </CardHeader>
            <CardContent>
                 <SettingsListItem icon={<MessageSquare />} title="Message Notifications" action={<Switch defaultChecked />} />
                 <Separator />
                 <SettingsListItem icon={<Users />} title="Group Notifications" action={<Switch defaultChecked />} />
                 <Separator />
                 <SettingsListItem icon={<Bell />} title="Sound & Vibration" action={<ChevronRight />} />
            </CardContent>
        </Card>

        {/* 5. Appearance */}
         <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Palette /> Appearance</CardTitle>
            </CardHeader>
            <CardContent>
                 <SettingsListItem icon={<Brush />} title="Dark Mode" action={
                    <Select defaultValue="auto">
                        <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="auto">System</SelectItem>
                        </SelectContent>
                    </Select>
                 } />
                 <Separator />
                 <SettingsListItem icon={<Languages />} title="App Language" description="English" action={<ChevronRight />} />
            </CardContent>
        </Card>
        
        {/* 6. Data & Storage */}
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Database /> Data & Storage</CardTitle>
            </CardHeader>
            <CardContent>
                 <SettingsListItem icon={<User />} title="Media Auto-Download" action={<ChevronRight />} />
                 <Separator />
                 <SettingsListItem icon={<Database />} title="Storage Usage" action={<ChevronRight />} />
                 <Separator />
                 <SettingsListItem icon={<Trash2 />} title="Clear Cache" action={<Button variant="outline" size="sm">Clear</Button>} />
            </CardContent>
        </Card>

        {/* 7. Help & Legal */}
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><HelpCircle /> Help & Legal</CardTitle>
            </CardHeader>
            <CardContent>
                 <SettingsListItem icon={<HelpCircle />} title="FAQ / Help Center" action={<ChevronRight />} />
                 <Separator />
                 <SettingsListItem icon={<FileText />} title="Contact Us / Report Problem" action={<ChevronRight />} />
                 <Separator />
                 <SettingsListItem icon={<FileText />} title="Privacy Policy" action={<ChevronRight />} />
                 <Separator />
                 <SettingsListItem icon={<FileText />} title="Terms & Conditions" action={<ChevronRight />} />
            </CardContent>
        </Card>

      </div>
    </ScrollArea>
  );
}
