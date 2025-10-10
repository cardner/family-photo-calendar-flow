import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Switch } from '@/components/ui/switch';

describe('Switch', () => {
  it('renders with base styling and toggles aria-checked state', async () => {
    const user = userEvent.setup();

    render(<Switch aria-label="Enable notifications" />);

    const toggle = screen.getByRole('switch', { name: 'Enable notifications' });
    expect(toggle).toHaveAttribute('data-state', 'unchecked');
    expect(toggle).toHaveClass('w-11');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('data-state', 'checked');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('honors the disabled prop', async () => {
    const user = userEvent.setup();

    render(<Switch aria-label="Disabled switch" disabled />);

    const toggle = screen.getByRole('switch', { name: 'Disabled switch' });
    expect(toggle).toHaveAttribute('data-disabled');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('data-state', 'unchecked');
  });
});
