// Shared button component interface
// Platform-specific implementations in apps/web and apps/mobile

export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  onPress?: () => void;
}

// Re-export for consumers — actual component implementations are platform-specific
export const Button = {} as React.FC<ButtonProps>;
