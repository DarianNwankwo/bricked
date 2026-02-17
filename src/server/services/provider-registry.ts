// Provider registry — factory for cloud providers

import type { CloudProvider } from './cloud-provider.js';

const providers = new Map<string, CloudProvider>();

export function registerProvider(provider: CloudProvider): void {
  providers.set(provider.name, provider);
}

export function getProvider(name: string): CloudProvider | undefined {
  return providers.get(name);
}

export function getDefaultProvider(): CloudProvider {
  const provider = providers.get('digitalocean');
  if (!provider) {
    throw new Error('No default cloud provider registered. Ensure DigitalOcean provider is initialized.');
  }
  return provider;
}

export function listProviders(): CloudProvider[] {
  return Array.from(providers.values());
}
