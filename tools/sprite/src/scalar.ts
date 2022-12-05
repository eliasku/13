/// Linearly interpolate (or extrapolate) between @c f1 and @c f2 by @c t percent.
export const lerp = (f1: number, f2: number, t: number) => f1 * (1.0 - t) + f2 * t;

// Lerps between two positions based on their sample values.
export const midLerp = (x0: number, x1: number, s0: number, s1: number, t: number): number =>
    lerp(x0, x1, (t - s0) / (s1 - s0));
