import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthProvider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ArrowLeft, User, Shield, Monitor } from 'lucide-react';
import ProfileTab from '@/components/settings/ProfileTab';
import SecurityTab from '@/components/settings/SecurityTab';
import SessionsTab from '@/components/settings/SessionsTab';

function getInitials(name, email) {
  if (name && name.trim()) {
    const parts = name.trim().split(' ').filter(p => p.length > 0);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  }
  if (email) {
    return email.substring(0, 2).toUpperCase();
  }
  return '??';
}

export default function Settings() {
  const { user } = useAuth();
  const initials = getInitials(user?.name, user?.email);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back link */}
      <Link to="/" className="inline-flex items-center text-blue-300 hover:text-blue-200 mb-6">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Home
      </Link>

      {/* Header with avatar */}
      <div className="flex items-center gap-6 mb-8">
        <Avatar className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-2xl font-bold">
          <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-600 text-white text-2xl font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-bold text-white">{user?.name || 'User'}</h1>
          <p className="text-blue-300">{user?.email}</p>
          {user?.role && (
            <span className="inline-block mt-1 px-2 py-0.5 bg-white/10 rounded text-xs text-blue-200">
              {user.role.replace('_', ' ')}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="bg-white/10 border border-white/20 mb-6">
          <TabsTrigger
            value="profile"
            className="data-[state=active]:bg-white/20 data-[state=active]:text-white text-blue-200"
          >
            <User className="w-4 h-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger
            value="security"
            className="data-[state=active]:bg-white/20 data-[state=active]:text-white text-blue-200"
          >
            <Shield className="w-4 h-4 mr-2" />
            Security
          </TabsTrigger>
          <TabsTrigger
            value="sessions"
            className="data-[state=active]:bg-white/20 data-[state=active]:text-white text-blue-200"
          >
            <Monitor className="w-4 h-4 mr-2" />
            Sessions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileTab />
        </TabsContent>

        <TabsContent value="security">
          <SecurityTab />
        </TabsContent>

        <TabsContent value="sessions">
          <SessionsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
