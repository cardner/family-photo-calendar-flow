import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

describe('Accordion primitives', () => {
  it('expands and collapses content when triggered', async () => {
    const user = userEvent.setup();

    render(
      <Accordion type="single" collapsible defaultValue="item-1">
        <AccordionItem value="item-1">
          <AccordionTrigger>First section</AccordionTrigger>
          <AccordionContent>Panel content</AccordionContent>
        </AccordionItem>
      </Accordion>
    );

    const trigger = screen.getByRole('button', { name: /first section/i });
    expect(trigger).toHaveAttribute('data-state', 'open');
    expect(screen.getByText('Panel content')).toBeVisible();

    await user.click(trigger);

    expect(trigger).toHaveAttribute('data-state', 'closed');
    expect(screen.queryByText('Panel content')).toBeNull();
  });
});
