export interface CardProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  onPress?: () => void;
  className?: string;
}

export const Card = {} as React.FC<CardProps>;
