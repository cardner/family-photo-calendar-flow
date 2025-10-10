import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';

const HoverCardFixture = () => (
  <HoverCard openDelay={0} closeDelay={0}>
    <HoverCardTrigger asChild>
      <button type="button">Show hover card</button>
    </HoverCardTrigger>
    <HoverCardContent data-testid="hover-card">
      Hover card body
    </HoverCardContent>
  </HoverCard>
);

describe('HoverCard primitives', () => {
  it('reveals the hover card when the trigger is hovered', async () => {
    const user = userEvent.setup();
    render(<HoverCardFixture />);

    expect(screen.queryByTestId('hover-card')).toBeNull();

    await user.hover(screen.getByRole('button', { name: 'Show hover card' }));

    const content = await screen.findByTestId('hover-card');
    expect(content).toHaveTextContent('Hover card body');
    expect(content).toHaveClass('w-64');

    await user.unhover(screen.getByRole('button', { name: 'Show hover card' }));
    await waitFor(() => expect(screen.queryByTestId('hover-card')).toBeNull());
  });
});
