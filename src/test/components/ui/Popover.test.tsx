import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const OpenPopover = () => (
  <Popover>
    <PopoverTrigger asChild>
      <button type="button">Open popover</button>
    </PopoverTrigger>
    <PopoverContent data-testid="popover-content">
      Popover body
    </PopoverContent>
  </Popover>
);

describe('Popover primitives', () => {
  it('toggles visibility when the trigger is interacted with', async () => {
    const user = userEvent.setup();
    render(<OpenPopover />);

    expect(screen.queryByTestId('popover-content')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Open popover' }));

    const content = await screen.findByTestId('popover-content');
    expect(content).toHaveTextContent('Popover body');
    expect(content).toHaveClass('w-72');

    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('popover-content')).toBeNull();
  });
});
