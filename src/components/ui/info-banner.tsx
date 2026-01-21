import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const infoBannerVariants = cva(
  "flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-sm transition-colors",
  {
    variants: {
      variant: {
        muted:
          "border-gray-200 bg-gray-50 text-gray-900 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-100",
        success:
          "border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-900/40 dark:text-green-100",
        info:
          "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-100",
        warning:
          "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100",
        destructive:
          "border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-900/40 dark:text-red-100",
      },
    },
    defaultVariants: {
      variant: "muted",
    },
  }
);

const infoBannerTitleVariants = cva("font-medium", {
  variants: {
    variant: {
      muted: "text-gray-900 dark:text-gray-100",
      success: "text-green-900 dark:text-green-100",
      info: "text-blue-900 dark:text-blue-100",
      warning: "text-amber-900 dark:text-amber-100",
      destructive: "text-red-900 dark:text-red-100",
    },
  },
  defaultVariants: {
    variant: "muted",
  },
});

const infoBannerDescriptionVariants = cva(
  "text-xs leading-snug text-muted-foreground",
  {
    variants: {
      variant: {
        muted: "text-gray-600 dark:text-gray-400",
        success: "text-green-700 dark:text-green-300",
        info: "text-blue-700 dark:text-blue-300",
        warning: "text-amber-700 dark:text-amber-200",
        destructive: "text-red-700 dark:text-red-300",
      },
    },
    defaultVariants: {
      variant: "muted",
    },
  }
);

export interface InfoBannerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof infoBannerVariants> {}

const InfoBanner = React.forwardRef<HTMLDivElement, InfoBannerProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(infoBannerVariants({ variant }), className)}
      {...props}
    />
  )
);
InfoBanner.displayName = "InfoBanner";

const InfoBannerIcon = React.forwardRef<HTMLElement, InfoBannerIconProps>(
  ({ className, asChild = true, ...props }, ref) => {
    const Comp = asChild ? Slot : "span";
    return (
      <Comp
        ref={ref}
        className={cn("mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center", className)}
        {...props}
      />
    );
  }
);
InfoBannerIcon.displayName = "InfoBannerIcon";

export type InfoBannerContentProps = React.HTMLAttributes<HTMLDivElement>;

const InfoBannerContent = React.forwardRef<HTMLDivElement, InfoBannerContentProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex-1 space-y-1", className)} {...props} />
  )
);
InfoBannerContent.displayName = "InfoBannerContent";

export interface InfoBannerTitleProps
  extends React.HTMLAttributes<HTMLParagraphElement>,
    VariantProps<typeof infoBannerTitleVariants> {}

const InfoBannerTitle = React.forwardRef<HTMLParagraphElement, InfoBannerTitleProps>(
  ({ className, variant, ...props }, ref) => (
    <p
      ref={ref}
      className={cn(infoBannerTitleVariants({ variant }), className)}
      {...props}
    />
  )
);
InfoBannerTitle.displayName = "InfoBannerTitle";

export interface InfoBannerDescriptionProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof infoBannerDescriptionVariants> {}

const InfoBannerDescription = React.forwardRef<
  HTMLDivElement,
  InfoBannerDescriptionProps
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(infoBannerDescriptionVariants({ variant }), className)}
    {...props}
  />
));
InfoBannerDescription.displayName = "InfoBannerDescription";

export interface InfoBannerIconProps
  extends React.HTMLAttributes<HTMLElement> {
  asChild?: boolean;
}

export {
  InfoBanner,
  InfoBannerIcon,
  InfoBannerContent,
  InfoBannerTitle,
  InfoBannerDescription,
};
