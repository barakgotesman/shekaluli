import Icon from '../Icon';

interface Props {
  photoBase64?: string;
}

/**
 * Fixed top app bar: app logo/name on the right, user avatar on the left.
 * Shows the profile photo when set, otherwise a generic person icon placeholder.
 * @param photoBase64 - the profile's saved photo (base64 data URL), if any
 */
export default function Header({ photoBase64 }: Props) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 mx-auto max-w-md bg-surface/85 shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-fixed text-primary">
            <Icon name="monitor_weight" className="text-[18px]" />
          </div>
          <span className="text-lg font-semibold tracking-tight text-on-surface">שקלולי</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-primary">
            {photoBase64 ? (
              <img src={photoBase64} alt="" className="h-full w-full object-cover" />
            ) : (
              <Icon name="person" className="text-on-primary text-[18px]" />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
