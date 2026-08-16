export const FEATURE_ACCENTS = ['#873bf4', '#2d8cf0', '#14b8a6', '#f59e0b', '#ed4014', '#eb2f96'] as const;

export const featureAccentOf = (index: number) => FEATURE_ACCENTS[index % FEATURE_ACCENTS.length];
