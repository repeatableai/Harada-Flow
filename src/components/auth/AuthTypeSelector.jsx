import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, User } from 'lucide-react';

export default function AuthTypeSelector({ onSelectType }) {
  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Choose Login Type</h2>
        <p className="text-blue-200">Select how you want to sign in</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Super Admin Card */}
        <Card 
          className="bg-white/10 backdrop-blur-lg border-white/20 hover:bg-white/20 transition-all cursor-pointer"
          onClick={() => onSelectType('superadmin')}
        >
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-white">Super Admin</CardTitle>
            </div>
            <CardDescription className="text-blue-200">
              Repeatable AI Admin Access
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white"
              onClick={(e) => {
                e.stopPropagation();
                onSelectType('superadmin');
              }}
            >
              Sign In as Admin
            </Button>
          </CardContent>
        </Card>

        {/* User Card */}
        <Card 
          className="bg-white/10 backdrop-blur-lg border-white/20 hover:bg-white/20 transition-all cursor-pointer"
          onClick={() => onSelectType('user')}
        >
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-white">User</CardTitle>
            </div>
            <CardDescription className="text-blue-200">
              User Access
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white"
              onClick={(e) => {
                e.stopPropagation();
                onSelectType('user');
              }}
            >
              Sign In as User
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

