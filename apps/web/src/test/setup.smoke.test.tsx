import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useState } from 'react';

describe('web test infra', () => {
  it('renders a hook and exposes jest-dom matchers', () => {
    const { result } = renderHook(() => useState(42));
    expect(result.current[0]).toBe(42);
    document.body.innerHTML = '<button>ok</button>';
    expect(document.querySelector('button')).toBeInTheDocument();
  });
});
