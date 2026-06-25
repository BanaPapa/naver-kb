import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({ 
  children, 
  className = '', 
  padding = 'md' 
}) => {
  const paddings = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };
  
  const classes = [
    'bg-white rounded-lg shadow-sm border border-gray-200',
    paddings[padding],
    className,
  ].join(' ');
  
  return (
    <div className={classes}>
      {children}
    </div>
  );
};