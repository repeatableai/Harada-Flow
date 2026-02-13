import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || 'An unknown error occurred';
      const isBase44Error = errorMessage.includes('404') || errorMessage.includes('not found') || 
                            errorMessage.includes('Base44') || errorMessage.includes('app');

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
          <Card className="bg-white/10 backdrop-blur-lg border-white/20 shadow-2xl max-w-2xl w-full">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-white flex items-center gap-3">
                <AlertCircle className="w-7 h-7 text-red-400" />
                {isBase44Error ? 'Base44 Configuration Error' : 'Application Error'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isBase44Error ? (
                <>
                  <p className="text-blue-200">
                    This application requires a valid Base44 app configuration to function properly.
                  </p>
                  <div className="bg-white/5 rounded-lg p-4 space-y-2">
                    <p className="text-white font-semibold">Possible issues:</p>
                    <ul className="list-disc list-inside text-blue-200 space-y-1 ml-2">
                      <li>The Base44 app ID is invalid or the app has been deleted</li>
                      <li>The app subdomain has been changed</li>
                      <li>You need to configure a valid Base44 app ID</li>
                    </ul>
                  </div>
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                    <p className="text-blue-200 text-sm">
                      <strong className="text-white">Current App ID:</strong> 68682c1685e4902d2e91e89a
                    </p>
                    <p className="text-blue-200 text-sm mt-2">
                      To fix this, update the app ID in <code className="bg-white/10 px-2 py-1 rounded">src/api/base44Client.js</code> with a valid Base44 app ID.
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-blue-200">{errorMessage}</p>
              )}
              <div className="flex gap-4 pt-4">
                <Button
                  onClick={() => window.location.reload()}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reload Page
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => this.setState({ hasError: false, error: null })}
                  className="bg-white/10 border border-white/20 text-white hover:bg-white/20"
                >
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

