'use client';

// Landed - useGoogleSignIn hook
// Loads Google Identity Services (GIS), initializes ID-token sign-in, and
// renders Google's official button safely with fallback prompt support.

import { useCallback, useEffect, useRef, useState } from 'react';

const GSI_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

interface UseGoogleSignInOptions {
  onCredential: (credential: string) => void;
  onError?: (error: string) => void;
  buttonText?: 'signin_with' | 'signup_with' | 'continue_with';
}

export function useGoogleSignIn({
  onCredential,
  onError,
  buttonText = 'continue_with',
}: UseGoogleSignInOptions) {
  const buttonContainerRef = useRef<HTMLDivElement | null>(null);
  const [isGisReady, setIsGisReady] = useState(false);
  const callbackRef = useRef(onCredential);
  callbackRef.current = onCredential;

  const errorRef = useRef(onError);
  errorRef.current = onError;

  const initializeAndRender = useCallback(() => {
    if (typeof window === 'undefined' || !window.google?.accounts?.id) return false;

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
    if (!clientId) {
      errorRef.current?.('Google Sign-In client ID is not configured.');
      return false;
    }

    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        use_fedcm_for_prompt: false,
        auto_select: false,
        callback: (response: { credential?: string }) => {
          if (!response.credential) {
            errorRef.current?.('Google did not return a sign-in credential.');
            return;
          }
          callbackRef.current(response.credential);
        },
      });

      setIsGisReady(true);

      const container = buttonContainerRef.current;
      if (container) {
        container.innerHTML = '';
        window.google.accounts.id.renderButton(container, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: buttonText,
          shape: 'rectangular',
          logo_alignment: 'left',
          width: 360,
        });
      }

      return true;
    } catch (err) {
      console.error('[GIS] Initialization error:', err);
      return false;
    }
  }, [buttonText]);

  const promptGoogleSignIn = useCallback(() => {
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          initializeAndRender();
        }
      });
    } else {
      errorRef.current?.('Google Sign-In is initializing. Please try again in a moment.');
    }
  }, [initializeAndRender]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.google?.accounts?.id) {
      initializeAndRender();
    } else {
      let script = document.getElementById('google-gsi-script') as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement('script');
        script.id = 'google-gsi-script';
        script.src = GSI_SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }

      const handleLoad = () => initializeAndRender();
      script.addEventListener('load', handleLoad);
      return () => {
        script?.removeEventListener('load', handleLoad);
      };
    }
  }, [initializeAndRender]);

  // Re-trigger layout render after mount
  useEffect(() => {
    const timer = setTimeout(() => {
      initializeAndRender();
    }, 100);
    return () => clearTimeout(timer);
  }, [initializeAndRender]);

  return { buttonContainerRef, isGisReady, promptGoogleSignIn };
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            use_fedcm_for_prompt?: boolean;
            auto_select?: boolean;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
          prompt: (listener?: (notification: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => void) => void;
        };
      };
    };
  }
}
