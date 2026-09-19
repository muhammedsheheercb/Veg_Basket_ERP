'use client';

import { useEffect } from 'react';

// Safely monkey-patch DOM removal/insertion to prevent React crash if browser extensions or DOM mutations desynchronize the DOM tree
if (typeof window !== 'undefined' && !(window as any).__DOM_MUTATION_GUARD_PATCHED__) {
  (window as any).__DOM_MUTATION_GUARD_PATCHED__ = true;

  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (child.parentNode !== this) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('DOM removeChild guarded: node is not a child of this parent.', child, this);
      }
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(newNode: T, referenceNode: Node | null): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('DOM insertBefore guarded: reference node is not a child of this parent.', referenceNode, this);
      }
      return newNode;
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };
}

const changing = /^(save|update|delete|create|record payment|pay|sign in)/i;

function lock(b: HTMLButtonElement) {
  if (b.disabled || b.dataset.loading) return false;
  b.dataset.loading = 'true';
  b.disabled = true;
  b.setAttribute('aria-busy', 'true');
  b.classList.add('is-mutation-loading');
  return true;
}

function unlock(b?: HTMLButtonElement) {
  if (!b?.dataset.loading) return;
  b.disabled = false;
  b.removeAttribute('aria-busy');
  b.classList.remove('is-mutation-loading');
  delete b.dataset.loading;
}

export function MutationGuard() {
  useEffect(() => {
    let active: HTMLButtonElement | undefined;
    const native = window.fetch.bind(window);

    const submit = (e: SubmitEvent) => {
      const f = e.target as HTMLFormElement;
      const b =
        (e.submitter as HTMLButtonElement | null) ||
        f.querySelector<HTMLButtonElement>('button[type="submit"],button:not([type])');
      if (b && !lock(b)) e.preventDefault();
      else active = b || undefined;
    };

    const click = (e: MouseEvent) => {
      const b = (e.target as Element).closest<HTMLButtonElement>('button');
      if (b && !b.form && !b.dataset.mutationGuardIgnore && changing.test(b.textContent || '')) {
        if (!lock(b)) e.preventDefault();
        else active = b;
      }
    };

    window.fetch = (async (...args: Parameters<typeof fetch>) => {
      const method = (args[1]?.method || 'GET').toUpperCase();
      let next = args;

      if (method !== 'GET' && typeof args[1]?.body === 'string') {
        try {
          const body = JSON.parse(args[1].body);
          if (!body.idempotencyKey) {
            next = [
              args[0],
              { ...args[1], body: JSON.stringify({ ...body, idempotencyKey: crypto.randomUUID() }) },
            ] as Parameters<typeof fetch>;
          }
        } catch {}
      }

      try {
        const response = await native(...next);
        if (response.ok && String(args[0]).includes('/payments')) {
          const toast = document.createElement('div');
          toast.className = 'success-toast';
          toast.textContent = 'Payment saved successfully.';
          document.body.append(toast);
          setTimeout(() => toast.remove(), 3000);
        }
        return response;
      } finally {
        if (method !== 'GET') {
          unlock(active);
          active = undefined;
        }
      }
    }) as typeof fetch;

    document.addEventListener('submit', submit, true);
    document.addEventListener('click', click, true);

    return () => {
      window.fetch = native;
      document.removeEventListener('submit', submit, true);
      document.removeEventListener('click', click, true);
    };
  }, []);

  return null;
}

