import type { Profile } from '../types';
import type { SyncConflict } from '../hooks/useAppData';
import Icon from './Icon';

interface Props {
  conflict: SyncConflict;
  onChoose: (choice: 'device' | 'account') => void;
}

/**
 * Blocking dialog shown when a guest with their own profile signs into a Google account that
 * already has a different profile: the user must pick which one to keep. Weight entries from
 * both sides are combined either way; the choice only decides the profile and same-date clashes.
 * @param conflict - summary of the profile/entries on this device and in the account
 * @param onChoose - called with the side the user wants to keep
 */
export default function SyncConflictModal({ conflict, onChoose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-inverse-surface/40 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className="my-auto flex w-full max-w-md flex-col gap-4 rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-2xl"
      >
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold text-on-surface">איזה פרופיל להשאיר?</h2>
          <p className="text-sm text-on-surface-variant">
            במכשיר הזה יש פרופיל שונה מזה שבחשבון Google שלך. השקילות משני המקומות יאוחדו בכל מקרה; הבחירה קובעת איזה פרופיל יישאר, ומה יקבע כששתי השקילות הן באותו תאריך.
          </p>
        </div>

        <ProfileCard title="במכשיר הזה" icon="smartphone" profile={conflict.device.profile} entryCount={conflict.device.entryCount} />
        <ProfileCard title="בחשבון Google" icon="cloud" profile={conflict.account.profile} entryCount={conflict.account.entryCount} />

        <div className="flex flex-col gap-2 pt-1">
          <button
            type="button"
            onClick={() => onChoose('account')}
            className="h-[48px] rounded-full bg-primary text-sm font-semibold text-on-primary shadow-md transition-all active:scale-[0.98]"
          >
            להשתמש בפרופיל מחשבון Google
          </button>
          <button
            type="button"
            onClick={() => onChoose('device')}
            className="h-[48px] rounded-full border border-outline-variant text-sm font-semibold text-on-surface transition-all active:scale-[0.98]"
          >
            להשאיר את הפרופיל של המכשיר הזה
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * One side of the choice: a short summary of a profile and how many weigh-ins go with it.
 * @param title - label for this side ("on this device" / "in Google account")
 * @param icon - Material Symbols icon name
 * @param profile - the profile to summarize
 * @param entryCount - number of weight entries stored on that side
 */
function ProfileCard({ title, icon, profile, entryCount }: { title: string; icon: string; profile: Profile; entryCount: number }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-surface-container-low p-3.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
        <Icon name={icon} className="text-[16px]" />
        <span>{title}</span>
      </div>
      <span className="text-base font-bold text-on-surface">{profile.name}</span>
      <span className="text-xs text-on-surface-variant">
        גובה {profile.heightCm} ס״מ • יעד {profile.goalWeightKg} ק״ג • {entryCount} שקילות
      </span>
    </div>
  );
}
