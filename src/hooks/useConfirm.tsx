import { useState, useCallback } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export function useConfirm() {
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions;
    resolver?: (value: boolean) => void;
  }>({
    isOpen: false,
    options: { message: '' }
  });

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        options,
        resolver: resolve
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (confirmState.resolver) {
      confirmState.resolver(true);
    }
    setConfirmState({ isOpen: false, options: { message: '' } });
  }, [confirmState]);

  const handleCancel = useCallback(() => {
    if (confirmState.resolver) {
      confirmState.resolver(false);
    }
    setConfirmState({ isOpen: false, options: { message: '' } });
  }, [confirmState]);

  const ConfirmDialogComponent = () => (
    <ConfirmDialog
      isOpen={confirmState.isOpen}
      title={confirmState.options.title}
      message={confirmState.options.message}
      confirmText={confirmState.options.confirmText}
      cancelText={confirmState.options.cancelText}
      variant={confirmState.options.variant}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );

  return { confirm, ConfirmDialog: ConfirmDialogComponent };
}
