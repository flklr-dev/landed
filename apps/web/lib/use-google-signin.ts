'use client';

// Landed - useGoogleSignIn hook
// Loads Google Identity Services (GIS), initializes ID-token sign-in, and
// renders Google's official button into a visible host element.

import { useCallback, useEffect, useRef } from 'react';

const GSI_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

interface UseGoogleSignInOptions {
  onCredential: (credential: string) => void;
  onError?: (error: string) => void;
  buttonText?: 'signin_with' | 'signup_with' | 'continue_with';
}

let globalGisInitialized = false;

export function useGoogleSignIn({
  onCredential,
  onError,
  buttonText = 'continue_with',
}: UseGoogleSignInOptions) {
  const buttonContainerRef = useRef<HTMLDivElement | null>(null);
  const callbackRef = useRef(onCredential);
  callbackRef.current = onCredential;

  const errorRef = useRef(onError);
  errorRef.current = onError;

  const initializeGoogle = useCallback((): boolean => {
    if (!window.google?.accounts?.id) return false;

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
    if (!clientId) {
      errorRef.current?.('Google Sign-In is not configured.');
      return false;
    }

    try {
      if (!globalGisInitialized) {
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
        globalGisInitialized = true;
      }

      const container = buttonContainerRef.current;
      if (!container) return true;

      container.innerHTML = '';
      window.google.accounts.id.renderButton(container, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: buttonText,
        shape: 'rectangular',
        logo_alignment: 'left',
        width: Math.max(240, Math.floor(container.getBoundingClientRect().width || 360)),
      });

      return true;
    } catch (err) {
      console.error('[GIS] Initialization error:', err);
      errorRef.current?.('Failed to initialize Google Sign-In.');
      return false;
    }
  }, [buttonText]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const setupGsi = () => {
      initializeGoogle();
    };

    if (window.google?.accounts?.id) {
      setupGsi();
      return;
    }

    let script = document.getElementById('google-gsi-script') as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = 'google-gsi-script';
      script.src = GSI_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    script.addEventListener('load', setupGsi);
    script.addEventListener('error', () => {
      errorRef.current?.('Failed to load Google Sign-In. Check your network or browser settings.');
    });

    return () => {
      script?.removeEventListener('load', setupGsi);
    };
  }, [initializeGoogle]);

  return { buttonContainerRef };
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
        };
      };
    };
  }
}
