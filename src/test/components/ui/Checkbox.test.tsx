import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Checkbox } from '@/components/ui/checkbox';

const CheckboxExample = ({ disabled = false }: { disabled?: boolean }) => (
  <label className="flex items-center gap-2">
    <Checkbox id="remember" disabled={disabled} />
    <span>Remember me</span>
  </label>
);

describe('Checkbox primitive', () => {
  it('toggles its checked state and classes on interaction', async () => {
    const user = userEvent.setup();

    render(<CheckboxExample />);

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toHaveAttribute('data-state', 'unchecked');
    expect(checkbox).toHaveClass('h-4', 'w-4');

    await user.click(checkbox);
    expect(checkbox).toHaveAttribute('data-state', 'checked');
    expect(checkbox).toHaveAttribute('aria-checked', 'true');
  });

  it('does not change state when disabled', async () => {
    const user = userEvent.setup();

    render(<CheckboxExample disabled />);

    const checkbox = screen.getByRole('checkbox');
  expect(checkbox).toHaveAttribute('data-disabled');

    await user.click(checkbox);
    expect(checkbox).toHaveAttribute('data-state', 'unchecked');
  });
});
