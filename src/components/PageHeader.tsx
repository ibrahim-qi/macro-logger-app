import React from 'react';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  large?: boolean;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  eyebrow,
  title,
  subtitle,
  action,
  large = false,
}) => (
  <header className={`page-header ${large ? 'page-header--large' : ''}`}>
    <div className="page-header__text">
      {eyebrow && <p className="page-header__eyebrow">{eyebrow}</p>}
      <h1 className="page-header__title">{title}</h1>
      {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
    </div>
    {action && <div className="page-header__action">{action}</div>}
  </header>
);

export default PageHeader;
