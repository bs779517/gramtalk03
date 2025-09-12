
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ChevronRight, Database, FileText, HelpCircle, KeyRound, Lock, Bell, Palette, User, Shield, ArrowLeft } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '../ui/scroll-area';

interface SettingsListItemProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  onClick?: () => void;
}

const SettingsListItem = ({ icon, title, description, action, onClick }: SettingsListItemProps) => (
  <div
    className="flex items-center p-3 hover:bg-secondary rounded-lg cursor-pointer"
    onClick={onClick}
  >
    <div className="mr-4 text-primary">{icon}</div>
    <div className="flex-grow">
      <p className="font-semibold">{title}</p>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
    {action && <div className="ml-4 text-muted-foreground">{action}</div>}
  </div>
);

interface SettingsViewProps {
    onBack: () => void;
}

export function SettingsView({ onBack }: SettingsViewProps) {
  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">

        {/* 1. Account Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><User /> Account</CardTitle>
          </CardHeader>
          <CardContent>
            <SettingsListItem icon={<KeyRound />} title="Change Password" action={<ChevronRight />} />
            <Separator />
            <SettingsListItem icon={<User />} title="Edit Profile" action={<ChevronRight />} />
          </CardContent>
        </Card>

        {/* 2. Privacy & Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Lock /> Privacy & Security</CardTitle>
          </CardHeader>
          <CardContent>
             <SettingsListItem 
                icon={<Shield />} 
                title="Profile Visibility" 
                description="Public" 
                action={<ChevronRight />} 
            />
            <Separator />
            <SettingsListItem icon={<FileText />} title="Two-Factor Authentication" description="Off" action={<ChevronRight />} />
             <Separator />
            <SettingsListItem icon={<Shield />} title="Blocked Users" action={<ChevronRight />} />
          </CardContent>
        </Card>

        {/* 3. Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Bell /> Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            <SettingsListItem icon={<Bell />} title="Push Notifications" action={<Switch defaultChecked />} />
          </CardContent>
        </Card>

        {/* 4. Appearance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Palette /> Appearance</CardTitle>
          </CardHeader>
          <CardContent>
            <SettingsListItem icon={<Palette />} title="Dark Mode" action={<Switch />} />
          </CardContent>
        </Card>

        {/* 5. Data & Storage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Database /> Data & Storage</CardTitle>
          </CardHeader>
          <CardContent>
            <SettingsListItem icon={<Database />} title="Clear Cache" action={<Button variant="outline" size="sm">Clear</Button>} />
          </CardContent>
        </Card>
        
        {/* 6. Help & Legal */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><HelpCircle /> Help & Legal</CardTitle>
          </CardHeader>
          <CardContent>
            <SettingsListItem icon={<HelpCircle />} title="Help Center" action={<ChevronRight />} />
            <Separator />
            <SettingsListItem icon={<FileText />} title="Terms of Service" action={<ChevronRight />} />
            <Separator />
            <SettingsListItem icon={<FileText />} title="Privacy Policy" action={<ChevronRight />} />
          </CardContent>
        </Card>

      </div>
    </ScrollArea>
  );
}
