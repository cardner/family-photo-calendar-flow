import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  InfoBanner,
  InfoBannerContent,
  InfoBannerDescription,
  InfoBannerIcon,
  InfoBannerTitle,
} from '@/components/ui/info-banner';

describe('InfoBanner', () => {
  it('renders the default muted variant styles by default', () => {
    render(
      <InfoBanner data-testid="banner">
        <InfoBannerIcon data-testid="icon" asChild={false}>
          !
        </InfoBannerIcon>
        <InfoBannerContent>
          <InfoBannerTitle>Default message</InfoBannerTitle>
          <InfoBannerDescription>
            Additional context
          </InfoBannerDescription>
        </InfoBannerContent>
      </InfoBanner>
    );

    const banner = screen.getByTestId('banner');
    expect(banner).toHaveClass('bg-gray-50');
    expect(banner).toHaveClass('border-gray-200');

    const title = screen.getByText('Default message');
    expect(title).toHaveClass('text-gray-900');

    const description = screen.getByText('Additional context');
    expect(description).toHaveClass('text-gray-600');

    const icon = screen.getByTestId('icon');
    expect(icon.tagName).toBe('SPAN');
    expect(icon).toHaveClass('inline-flex');
  });

  it('applies variant-specific styling for info banners', () => {
    render(
      <InfoBanner data-testid="info-banner" variant="info">
        <InfoBannerIcon asChild>
          <span data-testid="info-icon">i</span>
        </InfoBannerIcon>
        <InfoBannerContent>
          <InfoBannerTitle variant="info">Heads up!</InfoBannerTitle>
          <InfoBannerDescription variant="info">
            Something noteworthy happened.
          </InfoBannerDescription>
        </InfoBannerContent>
      </InfoBanner>
    );

    const banner = screen.getByTestId('info-banner');
    expect(banner).toHaveClass('bg-blue-50');
    expect(banner).toHaveClass('text-blue-900');

    const title = screen.getByText('Heads up!');
    expect(title).toHaveClass('text-blue-900');

    const description = screen.getByText('Something noteworthy happened.');
    expect(description).toHaveClass('text-blue-700');

    const slottedIcon = screen.getByTestId('info-icon');
    expect(slottedIcon).toHaveClass('inline-flex');
  });
});
