import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    coverage: {
      provider: 'c8',
      reporter: ['text', 'lcov'],
      all: false,
    },
    reporters: process.env.CI ? ['default', 'junit'] : ['default'],
  },
});
