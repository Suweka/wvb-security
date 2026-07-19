// Reusable styled <button> component used across the site.
// Lets callers pick a visual `variant` (color/style) and `size` instead of
// re-typing Tailwind classes everywhere, so all buttons stay visually consistent.

import React from 'react';
import { cn } from '@/lib/utils';

// Props for Button: extends all normal HTML <button> attributes (onClick, type,
// disabled, etc.) via ButtonHTMLAttributes, plus our own custom styling options.
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

// React.FC<ButtonProps> = "React Functional Component" typed with our props.
// Renders a <button> with Tailwind classes chosen from `variant` and `size`,
// falling back to sensible defaults ('primary', 'md') if not provided.
export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props // "rest" of the native button props (onClick, disabled, type, etc.) get passed straight through
}) => {
  // Styles shared by every button regardless of variant/size.
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';

  // Color/style classes keyed by variant name.
  const variants = {
    primary: 'bg-primary text-white hover:bg-primary-dark',
    secondary: 'bg-accent text-gray-900 dark:text-gray-100 hover:bg-accent-light',
    outline: 'border-2 border-primary text-primary hover:bg-primary hover:text-white',
    ghost: 'text-primary hover:bg-primary-light',
  };

  // Padding/font-size classes keyed by size name.
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-5 py-2.5 text-base',
    lg: 'px-7 py-3.5 text-lg',
  };

  return (
    <button
      // cn() merges all the class strings together, dropping any falsy ones
      // (see lib/utils.ts) so an optional `className` prop can override/extend styles.
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </button>
  );
};