declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void;
      render: (container: string | HTMLElement, parameters: {
        sitekey: string;
        callback?: (token: string) => void;
        'expired-callback'?: () => void;
        'error-callback'?: () => void;
        theme?: 'light' | 'dark';
        size?: 'normal' | 'compact';
      }) => number;
      reset: (widgetId?: number) => void;
      getResponse: (widgetId?: number) => string;
      execute: (widgetId?: number) => void;
    };
  }
}

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';

export function isRecaptchaConfigured(): boolean {
  return import.meta.env.VITE_RECAPTCHA_SITE_KEY !== undefined;
}

export function getRecaptchaSiteKey(): string {
  return RECAPTCHA_SITE_KEY;
}

export async function waitForRecaptcha(): Promise<void> {
  return new Promise((resolve) => {
    if (window.grecaptcha && window.grecaptcha.ready) {
      window.grecaptcha.ready(() => resolve());
    } else {
      const checkInterval = setInterval(() => {
        if (window.grecaptcha && window.grecaptcha.ready) {
          clearInterval(checkInterval);
          window.grecaptcha.ready(() => resolve());
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 10000);
    }
  });
}

export async function renderRecaptcha(
  containerId: string,
  callback?: (token: string) => void
): Promise<number | null> {
  try {
    await waitForRecaptcha();

    if (!window.grecaptcha) {
      console.warn('reCAPTCHA not loaded');
      return null;
    }

    const widgetId = window.grecaptcha.render(containerId, {
      sitekey: RECAPTCHA_SITE_KEY,
      callback: callback,
      'expired-callback': () => {
        console.log('reCAPTCHA expired');
      },
      'error-callback': () => {
        console.error('reCAPTCHA error');
      },
      theme: 'light',
      size: 'normal'
    });

    return widgetId;
  } catch (error) {
    console.error('Error rendering reCAPTCHA:', error);
    return null;
  }
}

export function getRecaptchaResponse(widgetId?: number): string {
  if (!window.grecaptcha) {
    return '';
  }
  return window.grecaptcha.getResponse(widgetId);
}

export function resetRecaptcha(widgetId?: number): void {
  if (window.grecaptcha) {
    window.grecaptcha.reset(widgetId);
  }
}

export async function verifyRecaptchaToken(token: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-recaptcha`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      }
    );

    const result = await response.json();
    return result.success === true;
  } catch (error) {
    console.error('Error verifying reCAPTCHA:', error);
    return false;
  }
}
