export interface InputProps {
  label?: string;
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  error?: string;
  type?: 'text' | 'email' | 'phone' | 'number' | 'password';
  disabled?: boolean;
  className?: string;
}

export const Input = {} as React.FC<InputProps>;
