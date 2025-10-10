import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

type TestValues = { email: string };

const FormExample = ({ withError = false }: { withError?: boolean }) => {
  const form = useForm<TestValues>({ defaultValues: { email: '' } });

  React.useEffect(() => {
    if (withError) {
      form.setError('email', {
        type: 'manual',
        message: 'Email is required',
      });
    }
  }, [form, withError]);

  return (
    <Form {...form}>
      <form>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormDescription>We use this for important updates.</FormDescription>
              <FormControl>
                <Input placeholder="name@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
};

describe('Form helpers', () => {
  it('links labels and descriptions to the form control', () => {
    render(<FormExample />);

    const input = screen.getByLabelText('Email') as HTMLInputElement;
    const description = screen.getByText('We use this for important updates.');
    const label = screen.getByText('Email');

    expect(input).toHaveAttribute('aria-invalid', 'false');
    expect(label).toHaveAttribute('for', input.id);
    expect(input.getAttribute('aria-describedby')).toBe(description.id);
    expect(screen.queryByText('Email is required')).toBeNull();
  });

  it('exposes validation errors through FormMessage and aria attributes', async () => {
    render(<FormExample withError />);

    const input = await screen.findByLabelText('Email');
    const description = screen.getByText('We use this for important updates.');
    const message = await screen.findByText('Email is required');

    const describedby = input.getAttribute('aria-describedby');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(describedby).toContain(description.id);
    expect(describedby).toContain(message.id);
  });
});
