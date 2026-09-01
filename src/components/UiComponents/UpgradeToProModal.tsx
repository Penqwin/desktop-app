
import Modal from "./Modal";

interface UpgradeToProModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
}

const PRO_FEATURES = [
  "Codebase to Documentation",
  "Unlimited Smart Sync",
  "Unlimited Documents",
  "Team collaboration",
];

export default function UpgradeToProModal({
  isOpen,
  onClose,
  title = "Upgrade your plan",
  message = "You have reached your Free plan limit.",
}: UpgradeToProModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      modalClass="!w-[500px]"
    >
      <div className="space-y-5">
        <p className="text-sm text-textSecondary">{message}</p>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-textMuted pb-2">
            Pro Features
          </p>
          <ul className="space-y-2">
            {PRO_FEATURES.map((feature) => (
              <li
                key={feature}
                className="text-sm text-textPrimary flex items-center gap-2 font-regular tracking-wider leading-relaxed"
              >
                <div className="flex-shrink-0 w-2 h-2 rounded-full bg-primary" />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <div className="pt-2 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-border text-textSecondary hover:text-textPrimary transition-colors"
          >
            Maybe Later
          </button>
          <a
            href="/pricing"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg bg-primary text-textPrimary hover:bg-primary/90 transition-colors"
          >
            Upgrade Plan
          </a>
        </div>
      </div>
    </Modal>
  );
}
