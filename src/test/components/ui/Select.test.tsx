import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

if (typeof HTMLElement !== 'undefined') {
  HTMLElement.prototype.hasPointerCapture ??= () => false;
  HTMLElement.prototype.setPointerCapture ??= () => {};
  HTMLElement.prototype.releasePointerCapture ??= () => {};
}

if (typeof Element !== 'undefined') {
  Element.prototype.scrollIntoView ??= () => {};
}

const SelectFixture = () => {
  const [value, setValue] = useState<string | undefined>();

  return (
    <>
      <p data-testid="selected-value">{value ?? 'none'}</p>
      <Select onValueChange={setValue}>
        <SelectTrigger aria-label="Choose framework" data-testid="select-trigger">
          <SelectValue placeholder="Select framework" />
        </SelectTrigger>
        <SelectContent data-testid="select-content">
          <SelectGroup>
            <SelectLabel>Web frameworks</SelectLabel>
            <SelectItem value="react">React</SelectItem>
            <SelectItem value="remix">Remix</SelectItem>
            <SelectItem value="astro" disabled>
              Astro
            </SelectItem>
            <SelectSeparator />
            <SelectItem value="solid">Solid</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </>
  );
};

describe('Select primitives', () => {
  it('shows placeholder text until a selection is made', () => {
    render(<SelectFixture />);

    expect(screen.getByTestId('select-trigger')).toHaveTextContent(
      'Select framework'
    );
  });

  it('opens the menu and updates the trigger with the selected option', async () => {
    const user = userEvent.setup();
    render(<SelectFixture />);

    const trigger = screen.getByRole('combobox', { name: 'Choose framework' });
    await user.click(trigger);

    const content = await screen.findByTestId('select-content');
    expect(content).toHaveClass('rounded-md');
    expect(screen.getByText('Web frameworks')).toBeInTheDocument();

    const disabledItem = screen.getByText('Astro').closest('[role="option"]');
    expect(disabledItem).toHaveAttribute('data-disabled');

    await user.click(screen.getByRole('option', { name: 'Remix' }));

    await waitFor(() => {
      expect(screen.getByTestId('selected-value')).toHaveTextContent(/remix/i);
      expect(
        screen.getByRole('combobox', { name: 'Choose framework' })
      ).toHaveTextContent('Remix');
    });
    expect(screen.queryByTestId('select-content')).toBeNull();
  });
});
