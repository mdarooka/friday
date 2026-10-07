/* The deterministic provider: the shared generator, no network, no credentials. */
import { generator } from '../catalog.mjs';

export function createLocalProvider() {
  return {
    name: 'local',
    async generate(dest, request) {
      return generator.generate(dest, {
        types: request.types, days: request.days, dates: request.dates, pace: request.pace, base: request.base
      });
    }
  };
}
