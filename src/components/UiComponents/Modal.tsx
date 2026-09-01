
import { useEffect, ReactNode } from "react";
import CloseIcon from "@mui/icons-material/Close";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  modalClass?: string;
  showCloseButton?: boolean;
  /** Optional content rendered on the right side of the modal header (e.g. action buttons). */
  headerRight?: ReactNode;
}

export default function Modal({ isOpen, onClose, title, children, modalClass, showCloseButton = true, headerRight }: ModalProps) {
  // Prevent scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => { document.body.style.overflow = "unset"; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-secondaryBg/60 backdrop-blur-sm">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={() => showCloseButton && onClose()} />

      <div className={`relative w-full max-w-2xl max-h-[90vh] overflow-hidden bg-mainBg rounded-xl shadow-2xl border border-border flex flex-col ${modalClass}`}>

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border gap-3">
          <h3 className="text-lg font-semibold text-textPrimary truncate">
            {title}
          </h3>
          <div className="flex items-center gap-2 shrink-0">
            {headerRight}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-1 hover:bg-secondaryBg rounded-md transition-colors"
              >
                <CloseIcon className="w-5 h-5 text-zinc-500" />
              </button>
            )}
          </div>
        </div>

        {/* Content — overflow-hidden so child panels scroll independently */}
        <div className="flex-1 min-h-0 overflow-hidden p-6 flex flex-col">
          {children}
        </div>
      </div>
    </div>
  );
}