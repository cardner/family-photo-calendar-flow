import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

describe('RadioGroup primitives', () => {
  it('renders items with base styling and allows selection', async () => {
    const user = userEvent.setup();

    render(
      <RadioGroup defaultValue="daily">
        <div className="flex items-center gap-2">
          <RadioGroupItem value="daily" id="daily" />
          <label htmlFor="daily">Daily</label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="weekly" id="weekly" />
          <label htmlFor="weekly">Weekly</label>
        </div>
      </RadioGroup>
    );

    const daily = screen.getByRole('radio', { name: 'Daily' });
    const weekly = screen.getByRole('radio', { name: 'Weekly' });

    expect(daily).toHaveAttribute('data-state', 'checked');
    expect(daily).toHaveClass('rounded-full');

    await user.click(weekly);

    expect(weekly).toHaveAttribute('data-state', 'checked');
    expect(screen.getByRole('radio', { name: 'Daily' })).toHaveAttribute('data-state', 'unchecked');
  });
});
