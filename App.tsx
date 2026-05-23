import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { openDb } from '@/db/client';
import Home from '@/screens/Home';

export default function App() {
  // Kick off DB initialisation (migrations + seed) as early as possible.
  // Home.tsx also calls openDb(), which returns the cached singleton.
  useEffect(() => {
    openDb().catch(() => {
      // Native SQLite is unavailable in the web/test environment — ignore.
    });
  }, []);

  return (
    <>
      <Home />
      <StatusBar style="light" />
    </>
  );
}
