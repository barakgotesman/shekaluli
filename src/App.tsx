import { useState } from 'react';
import type { WeightEntry } from './types';
import { useAppData } from './hooks/useAppData';
import { today } from './logic/dates';
import OnboardingPage from './pages/OnboardingPage';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import AddEntryModal from './components/AddEntryModal';
import AppRoutes from './routes/AppRoutes';

/**
 * Root component. Owns app state (profile, weight entries, theme) via `useAppData`,
 * renders onboarding until a profile exists, then the dashboard shell (header,
 * route-switched pages, bottom nav) and a modal for adding/editing weight entries.
 */
/** State of the add/edit-entry modal: closed, adding a new entry, or editing an existing one. */
type ModalState = { mode: 'closed' } | { mode: 'add' } | { mode: 'edit'; entry: WeightEntry };

export default function App() {
  const { profile, entries, theme, saveProfile, addWeight, deleteEntry, importEntries, exportEntries, changeTheme } =
    useAppData();
  const [editingProfile, setEditingProfile] = useState(false);
  const [modal, setModal] = useState<ModalState>({ mode: 'closed' });

  /** Persists the profile and exits onboarding/edit mode, unless the save failed. */
  function handleSaveProfile(p: Parameters<typeof saveProfile>[0]) {
    if (saveProfile(p)) setEditingProfile(false);
  }

  /** Adds or updates a weight entry, then closes the modal. */
  function handleAddWeight(date: string, weightKg: number, note: string) {
    addWeight(date, weightKg, note, modal.mode === 'edit' ? modal.entry.date : undefined);
    setModal({ mode: 'closed' });
  }

  if (!profile || editingProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface p-4">
        <OnboardingPage
          initial={profile}
          onSave={handleSaveProfile}
          onCancel={profile ? () => setEditingProfile(false) : undefined}
        />
      </div>
    );
  }

  const latest = entries[entries.length - 1];
  const todaysEntry = entries.find((e) => e.date === today());

  return (
    <div className="min-h-screen bg-surface-container-low font-body-md text-on-surface antialiased">
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col bg-surface shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <Header photoBase64={profile.photoBase64} name={profile.name} />

        <main className="w-full flex-1 bg-surface px-4 pt-20 pb-24">
          <AppRoutes
            profile={profile}
            entries={entries}
            theme={theme}
            onDeleteEntry={deleteEntry}
            onEditEntry={(entry) => setModal({ mode: 'edit', entry })}
            onExport={exportEntries}
            onImportFile={importEntries}
            onThemeChange={changeTheme}
            onEditProfile={() => setEditingProfile(true)}
          />
        </main>

        <Footer onAdd={() => setModal({ mode: 'add' })} />

        {modal.mode !== 'closed' && (
          <AddEntryModal
            onSubmit={handleAddWeight}
            onClose={() => setModal({ mode: 'closed' })}
            defaultWeight={todaysEntry?.weightKg ?? latest?.weightKg ?? profile.startWeightKg}
            editingEntry={modal.mode === 'edit' ? modal.entry : undefined}
          />
        )}
      </div>
    </div>
  );
}
