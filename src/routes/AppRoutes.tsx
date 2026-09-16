import { Navigate, Route, Routes } from 'react-router-dom';
import type { Profile, WeightEntry } from '../types';
import type { Theme } from '../logic/theme';
import type { ExportFormat } from '../hooks/useAppData';
import GraphPage from '../pages/GraphPage';
import HistoryPage from '../pages/HistoryPage';
import StatsPage from '../pages/StatsPage';
import SettingsPage from '../pages/SettingsPage';

interface Props {
  profile: Profile;
  entries: WeightEntry[];
  theme: Theme;
  onDeleteEntry: (date: string) => void;
  onEditEntry: (entry: WeightEntry) => void;
  onExport: (format: ExportFormat) => void;
  onImportFile: (file: File) => Promise<void>;
  onThemeChange: (theme: Theme) => void;
  onEditProfile: () => void;
}

/**
 * Route table for the four dashboard tabs (graph/history/stats/settings), rendered
 * inside `App.tsx`'s shell once a profile exists. Unknown paths (including "/") fall
 * back to the graph tab.
 */
export default function AppRoutes({
  profile,
  entries,
  theme,
  onDeleteEntry,
  onEditEntry,
  onExport,
  onImportFile,
  onThemeChange,
  onEditProfile,
}: Props) {
  return (
    <Routes>
      <Route path="/graph" element={<GraphPage entries={entries} profile={profile} />} />
      <Route
        path="/history"
        element={
          <HistoryPage
            entries={entries}
            profile={profile}
            onDelete={onDeleteEntry}
            onEdit={onEditEntry}
            onExport={onExport}
          />
        }
      />
      <Route path="/stats" element={<StatsPage entries={entries} profile={profile} />} />
      <Route
        path="/settings"
        element={
          <SettingsPage
            theme={theme}
            onThemeChange={onThemeChange}
            onEditProfile={onEditProfile}
            profile={profile}
            entries={entries}
            onImportFile={onImportFile}
            onExport={onExport}
          />
        }
      />
      <Route path="*" element={<Navigate to="/graph" replace />} />
    </Routes>
  );
}
