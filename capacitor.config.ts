import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.myhsbclineloan.app',
  appName: 'MyHSBC LineLoan',
  webDir: 'dist',
  server: {
    url: 'https://hsbc-fastloan.webgestion95.workers.dev',
    cleartext: true
  }
};

export default config;