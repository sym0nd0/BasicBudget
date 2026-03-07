import { useState, useCallback } from 'react';
import { createElement } from 'react';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

interface DialogState {
  resolve: (value: boolean) => void;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: 'primary' | 'danger';
}

export function useConfirmDialog() {
  const [state, setState] = useState<DialogState | null>(null);

  const confirm = useCallback(
    (title: string, message: string, variant: 'primary' | 'danger' = 'primary', confirmLabel?: string) =>
      new Promise<boolean>(resolve => {
        setState({ resolve, title, message, variant, confirmLabel });
      }),
    [],
  );

  const handleConfirm = useCallback(() => {
    state?.resolve(true);
    setState(null);
  }, [state]);

  const handleCancel = useCallback(() => {
    state?.resolve(false);
    setState(null);
  }, [state]);

  const ConfirmDialogElement = state
    ? createElement(ConfirmDialog, {
        isOpen: true,
        onConfirm: handleConfirm,
        onCancel: handleCancel,
        title: state.title,
        message: state.message,
        confirmLabel: state.confirmLabel,
        variant: state.variant,
      })
    : null;

  return { confirm, ConfirmDialogElement };
}
