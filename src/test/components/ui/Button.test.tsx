import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/button';

describe('Button', () => {
  it('renders a native button with default styling', () => {
    render(<Button>Click me</Button>);

    const button = screen.getByRole('button', { name: 'Click me' });
    expect(button.tagName).toBe('BUTTON');
    expect(button).toHaveClass('bg-primary');
    expect(button).toHaveClass('h-10');
  });

  it('applies variant and size modifiers', () => {
    render(
      <Button variant="outline" size="icon" aria-label="settings">
        <svg role="presentation" />
      </Button>
    );

    const button = screen.getByRole('button', { name: 'settings' });
    expect(button).toHaveClass('border');
    expect(button).toHaveClass('h-10');
    expect(button).toHaveClass('w-10');
  });

  it('supports rendering as a custom child element', () => {
    render(
      <Button asChild variant="link">
        <a href="/docs">Read the docs</a>
      </Button>
    );

    const link = screen.getByRole('link', { name: 'Read the docs' });
    expect(link.tagName).toBe('A');
    expect(link).toHaveClass('text-primary');
    expect(screen.queryByRole('button', { name: 'Read the docs' })).toBeNull();
  });
});
