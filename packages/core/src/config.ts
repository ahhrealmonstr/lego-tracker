export interface LegoTrackerConfig {
  rebrickableApiKey?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

let currentConfig: LegoTrackerConfig = {};

export function setConfig(config: LegoTrackerConfig) {
  currentConfig = { ...currentConfig, ...config };
}

export function getConfig(): LegoTrackerConfig {
  return currentConfig;
}
