import { RESTRICTED_PROPERTIES } from "@proyecto26/temporal-workflows";

export type DiscoveredActivities = Record<
  string,
  (...args: unknown[]) => unknown
>;

/**
 * Collect the activities of a registry the same way the worker of
 * `@proyecto26/temporal-workflows` does: every function on the immediate
 * prototype of the instance, bound to it. Use it in tests to register exactly
 * what the worker registers.
 */
export function discoverActivities(instance: object): DiscoveredActivities {
  const source = instance as Record<string, unknown>;
  return Object.getOwnPropertyNames(Object.getPrototypeOf(instance)).reduce(
    (acc, key) => {
      const property = source[key];
      if (
        !RESTRICTED_PROPERTIES.includes(key) &&
        typeof property === "function"
      ) {
        acc[key] = property.bind(instance);
      }
      return acc;
    },
    {} as DiscoveredActivities,
  );
}
