import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NewItemBadge } from '../../src/components/ui/NewItemBadge';

describe('NewItemBadge', () => {
  it('renders the highlighted pulse styling for new rows', () => {
    const html = renderToStaticMarkup(React.createElement(NewItemBadge));

    expect(html).toContain('New');
    expect(html).toContain('animate-pulse');
    expect(html).toContain('ring-[var(--color-info)]/35');
    expect(html).toContain('font-semibold');
  });
});
