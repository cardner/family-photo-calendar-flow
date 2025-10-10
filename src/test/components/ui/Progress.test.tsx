import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Progress } from '@/components/ui/progress';

describe('Progress', () => {
  it('renders with base styles and transforms indicator according to value', () => {
    render(<Progress value={25} />);

    const root = screen.getByRole('progressbar');
    expect(root).toHaveClass('rounded-full');

    const indicator = root.querySelector('div');
    expect(indicator).not.toBeNull();
    expect(indicator).toHaveStyle({ transform: 'translateX(-75%)' });
  });

  it('falls back to zero when no value is provided and merges custom classes', () => {
    render(<Progress className="bg-red-500" />);

    const root = screen.getByRole('progressbar');
    expect(root).toHaveClass('bg-red-500');

    const indicator = root.querySelector('div');
    expect(indicator).toHaveStyle({ transform: 'translateX(-100%)' });
  });
});
