
/* @__PURE__ */
export const quadraticOut = (t:number):number => {
    const x = 1 - t;
    return 1 - x * x;
}

/* @__PURE__ */
export const cubicOut = (t:number):number => {
    const x = 1 - t;
    return 1 - x * x * x;
}
