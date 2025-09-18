'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function GitHubSuccessPage() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleSuccess = async () => {
      try {
        const success = searchParams.get('success');
        const userId = searchParams.get('userId');
        
        console.log('GitHub success page loaded with params:', { success, userId });
        
        if (success === 'true' && userId) {
          // Fetch user data from backend
          console.log('Fetching user data from:', `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/auth/me`);
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/auth/me`, {
            credentials: 'include'
          });
          
          console.log('Auth response status:', response.status);
                  if (response.ok) {
          const user = await response.json();
          console.log('Fetched user data:', user);
          console.log('User keys:', Object.keys(user));
          console.log('Actual user object:', user.user);

          // Prepare success message - just pass the whole user object
          const message = {
            type: 'GITHUB_AUTH_SUCCESS',
            user: user.user || user // Pass the actual user data
          };
          
          console.log('Prepared message user data:', message.user);
            
            console.log('Sending message via BroadcastChannel and localStorage:', message);
            
            // Method 1: BroadcastChannel (modern browsers)
            try {
              const channel = new BroadcastChannel('github-auth');
              channel.postMessage(message);
              console.log('✅ Message sent via BroadcastChannel');
              channel.close();
            } catch (e) {
              console.log('❌ BroadcastChannel failed:', e instanceof Error ? e.message : String(e));
            }
            
            // Method 2: localStorage fallback
            try {
              localStorage.setItem('github-auth-success', JSON.stringify(message));
              console.log('✅ Message stored in localStorage');
              
              // Trigger storage event by updating another key
              localStorage.setItem('github-auth-trigger', Date.now().toString());
              
              // Clean up after 5 seconds
              setTimeout(() => {
                localStorage.removeItem('github-auth-success');
                localStorage.removeItem('github-auth-trigger');
                console.log('🧹 localStorage cleaned up');
              }, 5000);
            } catch (e) {
              console.log('❌ localStorage failed:', e instanceof Error ? e.message : String(e));
            }
            
            // Close popup after a short delay
            setTimeout(() => {
              console.log('Closing popup window');
              window.close();
            }, 1000);
          } else {
            console.error('Failed to fetch user data');
            setTimeout(() => window.close(), 2000);
          }
        } else {
          console.error('Invalid parameters:', { success, userId });
          setTimeout(() => window.close(), 2000);
        }
      } catch (error) {
        console.error('Error in GitHub success page:', error);
        setTimeout(() => window.close(), 2000);
      }
    };
    
    handleSuccess();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-green-500 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">GitHub Connected!</h1>
        <p className="text-gray-400">Redirecting back to Forge...</p>
      </div>
    </div>
  );
} 