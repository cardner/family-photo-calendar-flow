import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/utils/testUtils';
import userEvent from '@testing-library/user-event';
import { NotionUrlForm } from '@/components/settings/NotionUrlForm';

if (typeof HTMLElement !== 'undefined') {
  HTMLElement.prototype.hasPointerCapture ??= () => false;
  HTMLElement.prototype.setPointerCapture ??= () => {};
  HTMLElement.prototype.releasePointerCapture ??= () => {};
}

if (typeof Element !== 'undefined') {
  Element.prototype.scrollIntoView ??= () => {};
}

describe('NotionUrlForm', () => {
  it('requires a token in API mode before validating', async () => {
    const validateUrl = vi.fn().mockResolvedValue({ isValid: true });
    const user = userEvent.setup();
    await render(
      <NotionUrlForm
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        validateUrl={validateUrl}
      />
    );

    await user.type(
      screen.getByLabelText('Notion Database URL'),
      'https://notion.so/test-db-1234567890abcdef1234567890abcdef'
    );

    const testButton = screen.getByRole('button', { name: /test connection/i });
    expect(testButton).toBeDisabled();
    expect(validateUrl).not.toHaveBeenCalled();
  });

  it('offers public mode switch when CORS is blocked', async () => {
    const validateUrl = vi.fn().mockResolvedValue({
      isValid: false,
      error: 'CORS blocked',
      code: 'cors_blocked',
    });
    const user = userEvent.setup();

    await render(
      <NotionUrlForm
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        validateUrl={validateUrl}
      />
    );

    await user.type(
      screen.getByLabelText('Notion Integration Token'),
      'ntn_test_token_value_1234567890abcdef'
    );
    await user.type(
      screen.getByLabelText('Notion Database URL'),
      'https://notion.so/test-db-1234567890abcdef1234567890abcdef'
    );
    await user.click(screen.getByRole('button', { name: /test connection/i }));

    const switchButton = await screen.findByRole('button', { name: /switch to public shared page mode/i });
    await user.click(switchButton);

    expect(screen.queryByLabelText('Notion Integration Token')).not.toBeInTheDocument();
  });

  it('validates in public mode without requiring a token', async () => {
    const validateUrl = vi.fn().mockResolvedValue({ isValid: true });
    const user = userEvent.setup();

    await render(
      <NotionUrlForm
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        validateUrl={validateUrl}
      />
    );

    await user.type(
      screen.getByLabelText('Notion Database URL'),
      'https://notion.so/test-db-1234567890abcdef1234567890abcdef'
    );

    const modeSelect = screen.getByRole('combobox');
    await user.click(modeSelect);
    await user.click(screen.getByRole('option', { name: /public shared page/i }));

    await user.click(screen.getByRole('button', { name: /test connection/i }));

    expect(validateUrl).toHaveBeenCalledWith(
      'https://notion.so/test-db-1234567890abcdef1234567890abcdef',
      '',
      'public'
    );
  });
});
