import Modal from "@/app/components/UiComponents/Modal";
import { ReactNode } from "react";
import CircularLoader from "@/app/assets/svg/circular_loader";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  isLoading?: boolean;
  loadingLabel?: string;
}

export const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Action",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "primary",
  isLoading = false,
  loadingLabel = "Processing...",
}: ConfirmationModalProps) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      modalClass="!w-[500px]"
    >
      <div className="flex flex-col gap-6">
        <div className="text-textSecondary text-sm leading-relaxed">
          {message}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-textSecondary hover:text-textPrimary transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${
              variant === "danger"
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-primary hover:opacity-90 text-white"
            } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {isLoading && <CircularLoader size={14} />}
            {isLoading ? loadingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
};
