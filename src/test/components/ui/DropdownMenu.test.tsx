import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const MenuFixture = ({ onPrimarySelect }: { onPrimarySelect: () => void }) => {
  const [showStatusBar, setShowStatusBar] = useState(false);
  const [layout, setLayout] = useState('preview');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button">Open options</button>
      </DropdownMenuTrigger>
      <DropdownMenuContent data-testid="dropdown-content">
        <DropdownMenuLabel>Workspace</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={onPrimarySelect}>
            Preview item
            <DropdownMenuShortcut>⌘P</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuCheckboxItem
            data-testid="checkbox-item"
            checked={showStatusBar}
            onCheckedChange={(state) => setShowStatusBar(state === true)}
          >
            Show status bar
          </DropdownMenuCheckboxItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={layout} onValueChange={setLayout}>
          <DropdownMenuRadioItem value="preview">
            Preview layout
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="compact">
            Compact layout
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger data-testid="sub-trigger">
            Advanced
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent data-testid="sub-content">
            <DropdownMenuItem>Activity feed</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

describe('DropdownMenu primitives', () => {
  it('opens the menu and calls onSelect when an item is chosen', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<MenuFixture onPrimarySelect={onSelect} />);

    await user.click(screen.getByRole('button', { name: 'Open options' }));

    const menu = await screen.findByTestId('dropdown-content');
    expect(menu).toHaveClass('rounded-md');

    await user.click(screen.getByText('Preview item'));
    expect(onSelect).toHaveBeenCalledTimes(1);

    await waitFor(() => expect(screen.queryByTestId('dropdown-content')).toBeNull());
  });

  it('toggles checkbox items and updates radio group state', async () => {
    const user = userEvent.setup();
    const noop = vi.fn();
    render(<MenuFixture onPrimarySelect={noop} />);

    const trigger = screen.getByRole('button', { name: 'Open options' });
    await user.click(trigger);

    await screen.findByTestId('dropdown-content');

    const checkbox = await screen.findByRole('menuitemcheckbox', {
      name: 'Show status bar',
    });
    expect(checkbox).toHaveAttribute('aria-checked', 'false');

    await user.click(checkbox);
    await waitFor(() =>
      expect(checkbox).toHaveAttribute('aria-checked', 'true')
    );

    if (!screen.queryByTestId('dropdown-content')) {
      await user.click(trigger);
      await screen.findByTestId('dropdown-content');
    }

    const radio = screen.getByRole('menuitemradio', { name: 'Compact layout' });
    expect(radio).toHaveAttribute('aria-checked', 'false');

    await user.click(radio);
    await waitFor(() =>
      expect(radio).toHaveAttribute('aria-checked', 'true')
    );
  });
});
