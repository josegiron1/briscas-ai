/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/briscas-ai/' : '/',
  test: {
    include: ['tests/**/*.test.ts'],
  },
});

