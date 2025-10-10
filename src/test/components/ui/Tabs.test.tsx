import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

describe('Tabs primitives', () => {
  it('renders triggers with base styling and shows the default tab content', () => {
    render(
      <Tabs defaultValue="one">
        <TabsList data-testid="tabs-list">
          <TabsTrigger value="one">First</TabsTrigger>
          <TabsTrigger value="two">Second</TabsTrigger>
        </TabsList>
        <TabsContent value="one">First content</TabsContent>
        <TabsContent value="two">Second content</TabsContent>
      </Tabs>
    );

    const list = screen.getByTestId('tabs-list');
    expect(list).toHaveClass('inline-flex');

    const firstTrigger = screen.getByRole('tab', { name: 'First' });
    expect(firstTrigger).toHaveAttribute('data-state', 'active');
    expect(firstTrigger).toHaveClass('data-[state=active]:bg-background');

    const content = screen.getByText('First content');
    expect(content).toBeVisible();
    expect(content).toHaveClass('mt-2');
  });

  it('switches active tab on user interaction', async () => {
    const user = userEvent.setup();

    render(
      <Tabs defaultValue="one">
        <TabsList>
          <TabsTrigger value="one">First</TabsTrigger>
          <TabsTrigger value="two">Second</TabsTrigger>
        </TabsList>
        <TabsContent value="one">First content</TabsContent>
        <TabsContent value="two">Second content</TabsContent>
      </Tabs>
    );

    await user.click(screen.getByRole('tab', { name: 'Second' }));

    expect(screen.getByRole('tab', { name: 'Second' })).toHaveAttribute('data-state', 'active');
    expect(screen.getByText('Second content')).toBeVisible();
    expect(screen.getByRole('tab', { name: 'First' })).toHaveAttribute('data-state', 'inactive');
  });
});
