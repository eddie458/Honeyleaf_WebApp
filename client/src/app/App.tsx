import { useEffect, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { LoginScreen } from '../auth/LoginScreen';
import { SetupWizard } from '../auth/SetupWizard';
import { ChangePasswordScreen } from '../auth/ChangePasswordScreen';
import { NetworkError } from '../data/api';
import { queryClient, useSession } from '../data/queries';
import { DeskApp } from '../desk/DeskApp';
import { InkLoader } from '../desk/InkLoader';
import { ensureFonts } from '../library/fonts';
import { loadLibrary } from '../library/useLibrary';
import { t } from '../strings/en';

/** Fonts the desk needs before anything is measured or shown. */
const BOOT_FONTS = ['patrick-hand', 'caveat', 'dancing-script', 'special-elite', 'lora'];

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Root />
    </QueryClientProvider>
  );
}

function Root() {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    loadLibrary()
      .then(() => ensureFonts(BOOT_FONTS))
      .then(() => setReady(true))
      .catch(() => setFailed(true));
  }, []);
  const session = useSession();

  if (failed) return <InkLoader label={t.errors.network} />;
  if (!ready || session.isPending) return <InkLoader label={t.app.starting} />;
  if (session.isError) return <InkLoader label={session.error instanceof NetworkError ? t.auth.serverDown : t.errors.generic} />;
  const s = session.data;
  switch (s.state) {
    case 'setup':
      return <SetupWizard />;
    case 'signed_out':
      return <LoginScreen />;
    case 'locked':
      return s.user ? <LoginScreen locked={s.user} /> : <LoginScreen />;
    case 'signed_in':
      if (!s.user) return <LoginScreen />;
      if (s.user.mustChangePassword) return <ChangePasswordScreen />;
      return <DeskApp key={s.user.id} user={s.user} />;
  }
}
