import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

describe('Dialog primitives', () => {
  it('opens and closes the dialog via trigger and close button', async () => {
    const user = userEvent.setup();

    render(
      <Dialog>
        <DialogTrigger>Open dialog</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Preferences</DialogTitle>
            <DialogDescription>Update your settings below.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );

    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(screen.getByText('Open dialog'));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveClass('max-w-lg');
    expect(dialog).toHaveTextContent('Preferences');
    expect(dialog).toHaveTextContent('Update your settings below.');

    const closeButton = within(dialog).getByRole('button', { name: 'Close' });
    await user.click(closeButton);

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
